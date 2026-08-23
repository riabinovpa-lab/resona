import { Layout } from './components/Layout'
import { StoreProvider } from './store'
import { useStore } from './store-context'
import { Home } from './screens/Home'
import { Schedule } from './screens/Schedule'
import { Practice } from './screens/Practice'
import { Progress } from './screens/Progress'
import { Memberships, StudentDetail } from './screens/Memberships'
import { Theory, Article } from './screens/Theory'
import { Feedback } from './screens/Feedback'
import { More } from './screens/More'
import { Places } from './screens/Places'
import { Diary } from './screens/Diary'
import { Notices } from './screens/Notices'
import { Chat, Thread } from './screens/Chat'

function Screen() {
  const { screen } = useStore()
  switch (screen) {
    case 'home':
      return <Home />
    case 'schedule':
      return <Schedule />
    case 'practice':
      return <Practice />
    case 'progress':
      return <Progress />
    case 'memberships':
      return <Memberships />
    case 'student':
      return <StudentDetail />
    case 'theory':
      return <Theory />
    case 'article':
      return <Article />
    case 'feedback':
      return <Feedback />
    case 'more':
      return <More />
    case 'places':
      return <Places />
    case 'diary':
      return <Diary />
    case 'notices':
      return <Notices />
    case 'chat':
      return <Chat />
    case 'thread':
      return <Thread />
    default:
      return <Home />
  }
}

export default function App() {
  return (
    <StoreProvider>
      <Layout>
        <Screen />
      </Layout>
    </StoreProvider>
  )
}
