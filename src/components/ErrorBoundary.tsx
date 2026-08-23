import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { message: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null }

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : 'Неизвестная ошибка' }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Resona:', error, info.componentStack)
  }

  render() {
    if (!this.state.message) return this.props.children
    return (
      <div className="main" style={{ maxWidth: 560 }}>
        <h1 className="page-title">Что-то сломалось</h1>
        <p className="lede">
          Экран не отрисовался. Данные студии лежат в этом браузере — их можно очистить и начать с демо-набора.
        </p>
        <div className="card pad-lg">
          <p className="tiny muted">{this.state.message}</p>
          <div className="row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
            <button className="btn gold" onClick={() => location.reload()}>
              Перезагрузить
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                localStorage.removeItem('resona-studio-v6')
                location.reload()
              }}
            >
              Очистить данные и начать заново
            </button>
          </div>
        </div>
      </div>
    )
  }
}
