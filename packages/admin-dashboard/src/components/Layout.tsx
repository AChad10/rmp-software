import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: '📊' },
  { path: '/trainers', label: 'Trainers', icon: '👥' },
  { path: '/bsc-review', label: 'BSC Review', icon: '📋' },
  { path: '/salary', label: 'Salary', icon: '💰' },
  { path: '/audit-logs', label: 'Audit Logs', icon: '📝' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: '240px',
        minWidth: '240px',
        background: 'linear-gradient(180deg, #312e81 0%, #1e1b4b 100%)',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Logo / Title */}
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
          <h1 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Red Mat Pilates</h1>
          <p style={{ fontSize: '12px', opacity: 0.6, margin: '4px 0 0' }}>Payroll Admin</p>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 20px',
                textDecoration: 'none',
                color: isActive ? 'white' : 'rgba(255,255,255,0.7)',
                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                borderLeft: isActive ? '3px solid white' : '3px solid transparent',
                fontSize: '14px',
                fontWeight: isActive ? '600' : '400',
                transition: 'all 0.15s',
              })}
            >
              <span style={{ fontSize: '18px' }}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User / Logout */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
            <p style={{ opacity: 0.6, margin: 0, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Logged in as</p>
            <p style={{ margin: '2px 0 0', fontWeight: '600' }}>{user?.name || user?.email}</p>
          </div>
          <button
            onClick={logout}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', borderColor: 'rgba(255,255,255,0.2)' }}
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f7fafc' }}>
        {/* Top Bar */}
        <header style={{
          padding: '16px 28px',
          background: 'white',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '13px', color: '#6b7280' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </header>

        {/* Page Content */}
        <div style={{ flex: 1, padding: '28px', overflowY: 'auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
