import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { Layout, RequireAuth } from './layout/Layout';
import { Account } from './pages/Account';
import { Admin } from './pages/Admin';
import { Booking } from './pages/Booking';
import { Confirmation } from './pages/Confirmation';
import { Deposit } from './pages/Deposit';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { Signup } from './pages/Signup';
import { AuthProvider, BugsProvider } from './state';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <BugsProvider>
        <AuthProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="programare" element={<Booking />} />
              <Route path="autentificare" element={<Login />} />
              <Route path="cont-nou" element={<Signup />} />
              <Route path="avans/:id" element={<RequireAuth><Deposit /></RequireAuth>} />
              <Route path="confirmare/:id" element={<RequireAuth><Confirmation /></RequireAuth>} />
              <Route path="contul-meu" element={<RequireAuth><Account /></RequireAuth>} />
              <Route path="admin" element={<RequireAuth><Admin /></RequireAuth>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BugsProvider>
    </BrowserRouter>
  </StrictMode>,
);
