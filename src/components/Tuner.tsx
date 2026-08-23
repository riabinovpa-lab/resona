import { useCallback, useEffect, useRef, useState } from 'react'
import { detectPitch, noteFromFreq } from '../lib/pitch'

type Props = {
  targetMidi?: number
}

type Status = 'idle' | 'live' | 'denied' | 'insecure' | 'missing'

function initialStatus(): Status {
  if (!window.isSecureContext) return 'insecure'
  if (!navigator.mediaDevices?.getUserMedia) return 'missing'
  return 'idle'
}

export function Tuner({ targetMidi }: Props) {
  const [status, setStatus] = useState<Status>(initialStatus)
  const [hint, setHint] = useState('')
  const [freq, setFreq] = useState<number | null>(null)
  const [recUrl, setRecUrl] = useState<string | null>(null)
  const raf = useRef(0)
  const audio = useRef<AudioContext | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])

  const release = useCallback(() => {
    cancelAnimationFrame(raf.current)
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop()
    stream.current?.getTracks().forEach((t) => t.stop())
    void audio.current?.close()
    audio.current = null
    stream.current = null
    recorder.current = null
  }, [])

  useEffect(() => release, [release])

  const stop = () => {
    release()
    setStatus(initialStatus())
    setFreq(null)
  }

  const listen = async () => {
    setHint('')
    if (!window.isSecureContext) {
      setStatus('insecure')
      setHint('Chrome не показывает запрос микрофона на http://IP. Откройте http://localhost:5173/')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('missing')
      return
    }

    try {
      const perm = navigator.permissions
      if (perm?.query) {
        const q = await perm.query({ name: 'microphone' as PermissionName })
        if (q.state === 'denied') {
          setStatus('denied')
          setHint('Микрофон уже запрещён. Замок слева от адреса → «Настройки сайта» → Микрофон → Разрешить, затем обновите страницу.')
          return
        }
      }
    } catch {
      // Permissions API is optional
    }

    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true })
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      if (ctx.state === 'suspended') await ctx.resume()
      const source = ctx.createMediaStreamSource(media)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      source.connect(analyser)
      audio.current = ctx
      stream.current = media
      setStatus('live')

      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data)
      }
      rec.onstop = () => {
        if (!chunks.current.length) return
        if (recUrl) URL.revokeObjectURL(recUrl)
        setRecUrl(URL.createObjectURL(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })))
      }
      rec.start()
      recorder.current = rec

      const buf = new Float32Array(analyser.fftSize)
      const tick = () => {
        analyser.getFloatTimeDomainData(buf)
        setFreq(detectPitch(buf, ctx.sampleRate))
        raf.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setStatus('denied')
        setHint('Запрос был отклонён. Замок у адреса → Микрофон → Разрешить.')
      } else if (name === 'NotFoundError') {
        setHint('Браузер не видит микрофон. Проверьте, что устройство подключено в системе.')
      } else {
        setHint('Не удалось открыть микрофон. Запасной путь — загрузить запись ниже.')
      }
      setStatus(window.isSecureContext ? 'idle' : 'insecure')
    }
  }

  const onFile = async (file: File) => {
    setHint('')
    try {
      const ctx = new AudioContext()
      const decoded = await ctx.decodeAudioData(await file.arrayBuffer())
      const ch = decoded.getChannelData(0)
      const mid = Math.floor(ch.length / 2)
      const slice = ch.slice(Math.max(0, mid - 4096), mid + 4096)
      const found = detectPitch(slice, decoded.sampleRate)
      setFreq(found)
      if (recUrl) URL.revokeObjectURL(recUrl)
      setRecUrl(URL.createObjectURL(file))
      if (!found) setHint('В файле не нашла устойчивый тон. Нужна одна нота без аккомпанемента.')
      void ctx.close()
    } catch {
      setHint('Этот файл браузер не смог разобрать. Подойдёт wav или m4a.')
    }
  }

  const note = freq ? noteFromFreq(freq) : null
  const cents = note?.cents ?? 0
  const inTune = note != null && Math.abs(cents) <= 10
  const left = 50 + Math.max(-45, Math.min(45, cents))
  const target = targetMidi ? noteFromFreq(440 * 2 ** ((targetMidi - 69) / 12)) : null
  const live = status === 'live'

  return (
    <div className="card pad-lg">
      <div className="kicker">тюнер и диктофон</div>
      <div className="tuner-wrap">
        <div className="tuner-note">{note ? note.name : '—'}</div>
        <div className="tuner-sub">
          {note
            ? `${note.nameRu} · ${Math.round(freq ?? 0)} Гц · ${cents > 0 ? '+' : ''}${cents} центов`
            : live
              ? 'спойте устойчивый тон ближе к микрофону'
              : 'микрофон или загруженная запись'}
        </div>
        <div className="needle-box">
          <i className={inTune ? 'needle ok' : 'needle'} style={{ left: `${left}%` }} />
        </div>
        {target && <div className="tuner-sub">ориентир: {target.name} / {target.nameRu}</div>}
      </div>

      {status === 'insecure' && (
        <p className="tiny" style={{ color: 'var(--warn)', marginTop: 12 }}>
          Браузер не показывает запрос микрофона, если страница открыта как http://192.168… Откройте
          {' '}<a href="http://localhost:5173/">http://localhost:5173/</a> — там запрос появится. Либо загрузите запись.
        </p>
      )}
      {hint && <p className="tiny" style={{ color: 'var(--bad)', marginTop: 10 }}>{hint}</p>}

      <div className="row" style={{ marginTop: 16, flexWrap: 'wrap' }}>
        <button className={live ? 'btn ghost' : 'btn gold'} onClick={live ? stop : () => void listen()}>
          {live ? 'Стоп' : 'Включить микрофон'}
        </button>
        <label className="btn ghost">
          Загрузить запись
          <input
            type="file"
            accept="audio/*,.wav,.m4a,.mp3"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onFile(file)
              e.target.value = ''
            }}
          />
        </label>
      </div>
      <p className="tiny muted" style={{ marginTop: 10 }}>
        {live
          ? 'Идёт запись. Остановка сохранит дубль ниже.'
          : inTune
            ? 'в строе'
            : 'Если запрос не всплыл — загрузите дубль с телефона.'}
      </p>
      {recUrl && (
        <audio controls src={recUrl} style={{ width: '100%', marginTop: 12 }} />
      )}
    </div>
  )
}
