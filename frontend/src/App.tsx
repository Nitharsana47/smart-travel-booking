import { MotionConfig } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Footer, Navbar, ScrollManager, Toaster } from './components/Layout'
import { PageShell } from './components/ui'
import About from './pages/About'
import Admin from './pages/Admin'
import Auth from './pages/Auth'
import Details from './pages/Details'
import Home from './pages/Home'
import OffersPage from './pages/OffersPage'
import Payment from './pages/Payment'
import Search from './pages/Search'
import Seats from './pages/Seats'
import Ticket from './pages/Ticket'
import Trips from './pages/Trips'
import { useAuth } from './store/auth'
import { useBooking } from './store/booking'

function NotFound() {
  return (
    <PageShell className="grid place-items-center text-center">
      <div>
        <p className="font-display text-7xl font-extrabold text-sky-200">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold">This route isn't on our map</h1>
        <Link to="/" className="mt-6 inline-block font-bold text-sky-600">
          Back to home →
        </Link>
      </div>
    </PageShell>
  )
}

/** Resumes the session on page load and keeps "my bookings" in sync with who is signed in. */
function Session() {
  const init = useAuth((s) => s.init)
  const userId = useAuth((s) => s.user?.id)
  const { loadBookings, clearBookings } = useBooking.getState()
  useEffect(() => void init(), [init])
  useEffect(() => {
    if (userId) loadBookings().catch(() => undefined)
    else clearBookings()
  }, [userId, loadBookings, clearBookings])
  return null
}

/** Pages that need a signed-in user (and optionally a role). Waits for the startup session check. */
function RequireAuth({ children, role }: { children: ReactNode; role?: 'ADMIN' }) {
  const { user, ready } = useAuth()
  const { pathname, search } = useLocation()
  if (!ready)
    return (
      <PageShell className="grid place-items-center">
        <Loader2 className="animate-spin text-sky-500" size={32} />
      </PageShell>
    )
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <Session />
        <ScrollManager />
        <Navbar />
        <Toaster />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/book/seats" element={<Seats />} />
          <Route path="/book/details" element={<RequireAuth><Details /></RequireAuth>} />
          <Route path="/book/payment" element={<RequireAuth><Payment /></RequireAuth>} />
          <Route path="/ticket/:pnr" element={<RequireAuth><Ticket /></RequireAuth>} />
          <Route path="/trips" element={<RequireAuth><Trips /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth role="ADMIN"><Admin /></RequireAuth>} />
          <Route path="/offers" element={<OffersPage />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/register" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Footer />
      </BrowserRouter>
    </MotionConfig>
  )
}
