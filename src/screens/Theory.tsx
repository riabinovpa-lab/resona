import { SoftCard } from '../components/app-ui'
import { useStore } from '../store-context'

export function Theory() {
  const { articles, openArticle } = useStore()
  return (
    <section>
      <h1 className="page-title">Теория</h1>
      <p className="lede">Короткие тексты, которые мы опираем уроками. Читать лучше до практики, не вместо неё.</p>
      <SoftCard>
        {articles.map((a) => (
          <button key={a.id} className="cell" onClick={() => openArticle(a.id)}>
            <div className="grow">
              <div className="title">{a.title}</div>
              <div className="sub">{a.category} · {a.minutes} мин</div>
            </div>
          </button>
        ))}
      </SoftCard>
    </section>
  )
}

export function Article() {
  const { articles, articleId } = useStore()
  const a = articles.find((x) => x.id === articleId)
  if (!a) {
    return (
      <section>
        <h1 className="page-title">Текст</h1>
        <p className="empty">Материал не найден.</p>
      </section>
    )
  }
  return (
    <section>
      <p className="kicker">{a.category} · {a.minutes} мин</p>
      <h1 className="page-title">{a.title}</h1>
      <p className="lede">{a.lead}</p>
      <article className="article">
        {a.body.map((p) => (
          <p key={p.slice(0, 24)}>{p}</p>
        ))}
      </article>
    </section>
  )
}
