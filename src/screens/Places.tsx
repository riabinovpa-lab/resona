import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { SoftCard, StatusBadge } from '../components/app-ui'
import { useStore } from '../store-context'

const mapUrl = (address: string) => `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`

export function Places() {
  const { role, places, addPlace, updatePlace, removePlace, lessons } = useStore()
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', address: '', howTo: '', online: false })

  return (
    <section>
      <h1 className="page-title">Кабинеты</h1>
      <p className="lede">
        Адрес, короткая инструкция и ссылка на карты: как дойти, какой код, куда не звонить. Урок в сетке ссылается
        на кабинет.
      </p>

      <div className="grid">
        {places.map((p) => (
          <SoftCard key={p.id} className="p-5">
            <div className="row">
              <h2 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 22 }}>{p.name}</h2>
              {p.online && <StatusBadge>онлайн</StatusBadge>}
            </div>
            <p className="tiny muted" style={{ marginTop: 4 }}>
              {p.address}
            </p>

            {role === 'teacher' ? (
              <Field className="mt-3">
                <FieldLabel>как пройти</FieldLabel>
                <Textarea value={p.howTo} onChange={(e) => updatePlace(p.id, { howTo: e.target.value })} />
              </Field>
            ) : (
              <p style={{ marginTop: 12, lineHeight: 1.55 }}>{p.howTo}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              {!p.online && p.address && (
                <Button variant="outline" className="rounded-xl" asChild>
                  <a href={mapUrl(p.address)} target="_blank" rel="noreferrer">
                    Открыть в Яндекс.Картах
                  </a>
                </Button>
              )}
              {role === 'teacher' && (
                <Button variant="outline" className="rounded-xl" onClick={() => removePlace(p.id)}>
                  Удалить
                </Button>
              )}
            </div>

            <p className="tiny muted" style={{ marginTop: 10 }}>
              Привязано уроков: {lessons.filter((l) => l.locationId === p.id).length}
            </p>
          </SoftCard>
        ))}
        {places.length === 0 && <p className="empty">Кабинетов пока нет.</p>}
      </div>

      {role === 'teacher' && (
        <SoftCard className="mt-3 p-5">
          <div className="kicker">новый кабинет</div>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>название</FieldLabel>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Петроградка"
              />
            </Field>
            <Field>
              <FieldLabel>адрес · по нему строится ссылка на карты</FieldLabel>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Санкт-Петербург, Каменноостровский пр., 26"
              />
            </Field>
            <Field>
              <FieldLabel>как пройти</FieldLabel>
              <Textarea value={form.howTo} onChange={(e) => setForm({ ...form, howTo: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={form.online}
                onCheckedChange={(checked) => setForm({ ...form, online: checked === true })}
              />
              онлайн, без адреса
            </label>
            {error && <FieldError>{error}</FieldError>}
          </FieldGroup>
          <Button
            className="mt-3 rounded-xl"
            onClick={() => {
              if (!form.name.trim()) return setError('Нужно название кабинета')
              if (!form.online && !form.address.trim()) return setError('Нужен адрес или отметка «онлайн»')
              setError('')
              addPlace({
                name: form.name.trim(),
                address: form.address.trim(),
                howTo: form.howTo.trim(),
                online: form.online,
              })
              setForm({ name: '', address: '', howTo: '', online: false })
            }}
          >
            Добавить кабинет
          </Button>
        </SoftCard>
      )}
    </section>
  )
}
