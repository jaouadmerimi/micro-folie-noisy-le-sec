import { createRoot } from 'react-dom/client';
import AdminClient from '../components/admin-client';
import AccountForm from '../components/account-form';
import ReservationClient from '../components/reservation-client';
import '../app/globals.css';
const route = window.location.pathname.replace(/\/$/, '');
const page = route.endsWith('/reservation') ? <ReservationClient /> : route.endsWith('/admin/activation') ? <AccountForm mode="activate" /> : route.endsWith('/admin/mot-de-passe') ? <AccountForm mode="reset" /> : <AdminClient />;
createRoot(document.getElementById('root')!).render(page);
