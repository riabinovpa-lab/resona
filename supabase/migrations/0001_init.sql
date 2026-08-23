-- Resona: студия голоса. Схема на одну студию: один педагог, много учеников.
--
-- Модель доступа устроена несимметрично. Педагог правит таблицы напрямую под
-- защитой RLS, а ученику прямая запись запрещена почти везде: он действует через
-- функции внизу файла. Иначе ученик из консоли браузера дописал бы себе занятий
-- в абонемент или отметил чужой урок как проведённый.

-- gen_random_uuid() входит в ядро Postgres с 13-й версии: расширения не нужны.

-- Код-приглашение читают вслух и переписывают с чужого экрана, поэтому в алфавите
-- нет пар, которые путают: ни нуля с буквой O, ни единицы с I.
create or replace function public.gen_invite()
returns text
language sql
volatile
as $$
  select string_agg(substr('ACDEFGHJKLMNPQRTUVWXY34679', 1 + floor(random() * 26)::int, 1), '')
  from generate_series(1, 6);
$$;

-- ---------------------------------------------------------------- таблицы

-- Кто вошёл в приложение. student_id связывает аккаунт с карточкой ученика:
-- педагог заводит карточку заранее, аккаунт появляется позже по коду-приглашению.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('teacher', 'student')),
  student_id uuid,
  email text,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  call_name text,
  short text not null default '',
  voice text not null default '',
  city text not null default '',
  since text not null default '',
  plan_id text not null default 'pack8',
  remaining int not null default 0 check (remaining >= 0),
  used int not null default 0 check (used >= 0),
  payment text not null default 'due' check (payment in ('paid', 'due', 'overdue')),
  next_goal text not null default '',
  range_low int not null default 55,
  range_high int not null default 72,
  start_low int not null default 55,
  start_high int not null default 72,
  skills jsonb not null default '[]'::jsonb,
  repertoire jsonb not null default '[]'::jsonb,
  streak int not null default 0,
  practice_week jsonb not null default '[0,0,0,0,0,0,0]'::jsonb,
  -- Одноразовый код: ученик вводит его при первом входе и получает свою карточку.
  invite_code text unique default public.gen_invite(),
  created_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_student_fk foreign key (student_id) references public.students (id) on delete set null;

create table public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  how_to text not null default '',
  online boolean not null default false
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  starts_at timestamptz not null,
  duration int not null check (duration between 15 and 240),
  focus text not null default '',
  homework text not null default '',
  status text not null default 'upcoming' check (status in ('upcoming', 'done', 'cancelled', 'missed')),
  location_id uuid references public.places (id) on delete set null,
  homework_done_at timestamptz,
  -- Уроки одной еженедельной серии делят этот идентификатор.
  series_id uuid
);

create index lessons_starts_at_idx on public.lessons (starts_at);
create index lessons_student_idx on public.lessons (student_id);

-- Рабочее окно педагога: из них вычитаются занятые уроки и получаются свободные слоты.
create table public.slots (
  id uuid primary key default gen_random_uuid(),
  weekday int not null check (weekday between 1 and 7),
  from_time time not null,
  to_time time not null,
  location_id uuid references public.places (id) on delete set null,
  check (from_time < to_time)
);

create table public.moves (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.lessons (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  proposed_at timestamptz not null,
  comment text not null default '',
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index moves_pending_idx on public.moves (status) where status = 'pending';

create table public.diary (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create table public.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  from_role text not null check (from_role in ('teacher', 'student')),
  body text not null,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on public.messages (student_id, created_at);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  energy int not null default 3,
  clarity text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

-- Что человек уже видел: чтобы счётчики непрочитанного жили между устройствами.
create table public.seen (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  chat timestamptz not null default 'epoch',
  notices timestamptz not null default 'epoch'
);

-- ---------------------------------------------------------------- кто есть кто

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'teacher');
$$;

create or replace function public.my_student_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select student_id from profiles where id = auth.uid();
$$;

-- Первый зарегистрировавшийся становится педагогом: студию заводит она сама.
-- Все последующие входят учениками и остаются без данных, пока не введут код.
create or replace function public.on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_user boolean;
begin
  select not exists (select 1 from profiles where role = 'teacher') into first_user;

  insert into profiles (id, role, email)
  values (new.id, case when first_user then 'teacher' else 'student' end, new.email);

  insert into seen (profile_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.on_auth_user_created();

-- Аккаунты, созданные до этой миграции, триггер уже не догонит: без профиля они
-- остались бы нерабочими навсегда. Педагогом становится самый ранний из них.
insert into public.profiles (id, role, email)
select u.id,
       case when row_number() over (order by u.created_at) = 1 then 'teacher' else 'student' end,
       u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

insert into public.seen (profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.places enable row level security;
alter table public.lessons enable row level security;
alter table public.slots enable row level security;
alter table public.moves enable row level security;
alter table public.diary enable row level security;
alter table public.notices enable row level security;
alter table public.messages enable row level security;
alter table public.feedback enable row level security;
alter table public.seen enable row level security;

create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_teacher());

create policy profiles_teacher_write on public.profiles for update
  using (public.is_teacher()) with check (public.is_teacher());

-- Ученик видит только свою карточку: чужие абонементы и оценки его не касаются.
create policy students_read on public.students for select
  using (public.is_teacher() or id = public.my_student_id());

create policy students_teacher_all on public.students for all
  using (public.is_teacher()) with check (public.is_teacher());

-- Кабинеты, рабочие окна и объявления нужны всем: без них не выбрать время.
create policy places_read on public.places for select using (auth.uid() is not null);
create policy places_write on public.places for all
  using (public.is_teacher()) with check (public.is_teacher());

create policy slots_read on public.slots for select using (auth.uid() is not null);
create policy slots_write on public.slots for all
  using (public.is_teacher()) with check (public.is_teacher());

create policy notices_read on public.notices for select using (auth.uid() is not null);
create policy notices_write on public.notices for all
  using (public.is_teacher()) with check (public.is_teacher());

create policy lessons_read on public.lessons for select
  using (public.is_teacher() or student_id = public.my_student_id());

create policy lessons_teacher_all on public.lessons for all
  using (public.is_teacher()) with check (public.is_teacher());

create policy moves_read on public.moves for select
  using (public.is_teacher() or student_id = public.my_student_id());

create policy moves_teacher_all on public.moves for all
  using (public.is_teacher()) with check (public.is_teacher());

create policy diary_read on public.diary for select
  using (public.is_teacher() or student_id = public.my_student_id());

create policy diary_teacher_all on public.diary for all
  using (public.is_teacher()) with check (public.is_teacher());

create policy feedback_read on public.feedback for select
  using (public.is_teacher() or student_id = public.my_student_id());

create policy feedback_student_insert on public.feedback for insert
  with check (student_id = public.my_student_id());

create policy messages_read on public.messages for select
  using (public.is_teacher() or student_id = public.my_student_id());

-- Подписаться чужим именем нельзя: роль в сообщении обязана совпасть с ролью автора.
create policy messages_insert on public.messages for insert
  with check (
    (public.is_teacher() and from_role = 'teacher')
    or (student_id = public.my_student_id() and from_role = 'student')
  );

create policy seen_own on public.seen for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------------------------------------------------------------- занятость

-- Ученик не видит чужих уроков, но обязан знать, что время занято: иначе он
-- предложит перенос на занятый час и получит отказ. Здесь только время и
-- длительность — ни имени, ни темы, ни кабинета.
create view public.busy
with (security_invoker = off)
as
  select starts_at, duration
  from public.lessons
  where status <> 'cancelled';

-- Права на этот вид выданы ниже, в разделе про права: он обходит RLS, и запись
-- через него пришлось бы отбирать отдельно.

-- ---------------------------------------------------------------- действия ученика

-- Ученик привязывает свой аккаунт к карточке, которую педагог заранее завела.
create or replace function public.claim_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  if auth.uid() is null then
    raise exception 'Нужен вход в приложение';
  end if;

  -- Иначе педагог, введя код, разжаловала бы себя в ученика.
  if public.is_teacher() then
    raise exception 'Педагогу код не нужен';
  end if;

  select id into target from students
  where invite_code is not null and upper(invite_code) = upper(trim(p_code));

  if target is null then
    raise exception 'Код не найден';
  end if;

  if exists (select 1 from profiles where student_id = target and id <> auth.uid()) then
    raise exception 'Этим кодом уже воспользовались';
  end if;

  update profiles set student_id = target, role = 'student' where id = auth.uid();
  update students set invite_code = null where id = target;
  return target;
end;
$$;

create or replace function public.toggle_homework(p_lesson uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  done timestamptz;
begin
  update lessons set homework_done_at = case when homework_done_at is null then now() else null end
  where id = p_lesson and (public.is_teacher() or student_id = public.my_student_id())
  returning homework_done_at into done;

  if not found then
    raise exception 'Урок не найден';
  end if;
  return done;
end;
$$;

create or replace function public.log_practice(p_minutes int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_student_id();
  idx int;
  week jsonb;
begin
  if me is null then
    raise exception 'Профиль не связан с учеником';
  end if;
  if p_minutes <= 0 or p_minutes > 600 then
    raise exception 'Недопустимое число минут';
  end if;

  -- В Postgres неделя начинается с воскресенья, в расписании — с понедельника.
  idx := case extract(dow from now())::int when 0 then 6 else extract(dow from now())::int - 1 end;

  select practice_week into week from students where id = me;
  week := jsonb_set(week, array[idx::text], to_jsonb(coalesce((week ->> idx)::int, 0) + p_minutes));

  update students set practice_week = week, streak = greatest(streak, 1) where id = me;
end;
$$;

-- Правило переноса живёт в базе, а не только в интерфейсе: иначе его легко обойти.
create or replace function public.request_move(p_lesson uuid, p_at timestamptz, p_comment text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := public.my_student_id();
  lesson lessons;
  fresh uuid;
begin
  -- Функция обходит RLS, поэтому право на урок проверяем здесь сами.
  if not public.is_teacher() and me is null then
    raise exception 'Профиль не связан с учеником';
  end if;

  select * into lesson from lessons where id = p_lesson;
  if lesson is null then
    raise exception 'Урок не найден';
  end if;
  if not public.is_teacher() and lesson.student_id <> me then
    raise exception 'Это не ваш урок';
  end if;
  if lesson.status <> 'upcoming' then
    raise exception 'Урок уже закрыт';
  end if;
  if lesson.starts_at - now() < interval '12 hours' then
    raise exception 'До урока меньше 12 часов: перенос только через педагога';
  end if;
  if p_at <= now() then
    raise exception 'Нельзя перенести в прошлое';
  end if;

  delete from moves where lesson_id = p_lesson and status = 'pending';

  insert into moves (lesson_id, student_id, proposed_at, comment)
  values (p_lesson, lesson.student_id, p_at, coalesce(p_comment, ''))
  returning id into fresh;

  return fresh;
end;
$$;

-- Решение по заявке меняет урок и заявку одной транзакцией: иначе можно
-- получить принятый перенос без сдвинутого урока.
create or replace function public.resolve_move(p_move uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request moves;
  lesson lessons;
begin
  if not public.is_teacher() then
    raise exception 'Решение принимает педагог';
  end if;

  select * into request from moves where id = p_move;
  if request is null then
    raise exception 'Заявка не найдена';
  end if;

  if p_accept then
    select * into lesson from lessons where id = request.lesson_id;

    if exists (
      select 1 from lessons l
      where l.id <> lesson.id
        and l.status <> 'cancelled'
        and tstzrange(l.starts_at, l.starts_at + make_interval(mins => l.duration))
            && tstzrange(request.proposed_at, request.proposed_at + make_interval(mins => lesson.duration))
    ) then
      raise exception 'Это время уже занято';
    end if;

    -- Перенесённый урок выпадает из еженедельной серии: дальше он живёт сам.
    update lessons set starts_at = request.proposed_at, series_id = null where id = lesson.id;
  end if;

  update moves
  set status = case when p_accept then 'accepted' else 'declined' end, decided_at = now()
  where id = p_move;
end;
$$;

create or replace function public.mark_seen(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key not in ('chat', 'notices') then
    raise exception 'Неизвестный счётчик';
  end if;

  insert into seen (profile_id) values (auth.uid())
  on conflict (profile_id) do nothing;

  if p_key = 'chat' then
    update seen set chat = now() where profile_id = auth.uid();
  else
    update seen set notices = now() where profile_id = auth.uid();
  end if;
end;
$$;

-- ---------------------------------------------------------------- счётчик абонемента

-- Проведённый и пропущенный урок списываются с абонемента одинаково.
create or replace function public.burns(p_status text)
returns boolean
language sql
immutable
as $$
  select p_status in ('done', 'missed');
$$;

-- Счётчик занятий считает база, а не клиент: два устройства, меняющие статусы
-- одновременно, иначе разошлись бы в остатке абонемента.
create or replace function public.sync_plan_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  before_burn boolean := case when tg_op = 'INSERT' then false else public.burns(old.status) end;
  after_burn boolean := case when tg_op = 'DELETE' then false else public.burns(new.status) end;
  owner uuid := case when tg_op = 'DELETE' then old.student_id else new.student_id end;
  delta int;
begin
  -- Урок мог переехать к другому ученику: тогда списание снимается с прежнего.
  if tg_op = 'UPDATE' and old.student_id <> new.student_id then
    if before_burn then
      update students set used = greatest(0, used - 1), remaining = remaining + 1 where id = old.student_id;
    end if;
    if after_burn then
      update students set used = used + 1, remaining = greatest(0, remaining - 1) where id = new.student_id;
    end if;
    return new;
  end if;

  delta := (case when after_burn then 1 else 0 end) - (case when before_burn then 1 else 0 end);
  if delta <> 0 then
    update students
    set used = greatest(0, used + delta), remaining = greatest(0, remaining - delta)
    where id = owner;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger lessons_sync_counter
  after insert or update or delete on public.lessons
  for each row execute function public.sync_plan_counter();

-- ---------------------------------------------------------------- права

-- RLS решает, какие строки видны, но до строк дело не дойдёт без права на саму
-- таблицу. В свежем проекте Supabase такие права выдаются в схеме public по
-- умолчанию, только default privileges привязаны к схеме и исчезают вместе с ней
-- при пересоздании. Поэтому выдаём явно и не полагаемся на настройки проекта.
--
-- Роль anon не получает ничего: в приложении нет ни одного экрана до входа.
grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Простой вид из одной таблицы Postgres считает изменяемым, а busy вдобавок
-- работает от имени владельца и RLS не подчиняется. Право писать через него
-- означало бы право править и удалять чужие уроки в обход всех политик.
revoke insert, update, delete on public.busy from authenticated;

-- PostgREST держит схему в кеше и без этого не увидит новые таблицы.
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------- живые обновления

-- Чтобы заявка на перенос и сообщение появлялись у второй стороны без перезагрузки.
alter publication supabase_realtime add table public.students;
alter publication supabase_realtime add table public.lessons;
alter publication supabase_realtime add table public.slots;
alter publication supabase_realtime add table public.moves;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.notices;
alter publication supabase_realtime add table public.diary;
alter publication supabase_realtime add table public.places;
alter publication supabase_realtime add table public.feedback;
