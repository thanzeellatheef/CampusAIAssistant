import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Alert } from '../common/Alert';
import { useAuth } from '../../features/auth/useAuth';

export function RoleLayout({ title }: { title: string }) {
	const { user, logout } = useAuth();
	const navigate = useNavigate();
	const [logoutError, setLogoutError] = useState<string | null>(null);
	const [loggingOut, setLoggingOut] = useState(false);

	async function onLogout() {
		setLoggingOut(true);
		setLogoutError(null);
		try {
			await logout();
			navigate('/login');
		} catch {
			setLogoutError('Could not log out. Try again.');
		} finally {
			setLoggingOut(false);
		}
	}

	return (
		<div className="shell role-shell">
			<aside className="sidebar role-sidebar">
				<div className="role-brand-lockup">
					<span className="role-brand-mark" aria-hidden="true">C</span>
					<div><strong>Campus</strong><span>{title}</span></div>
				</div>
			</aside>
			<div className="workspace">
				<header className="topbar">
					<p className="topbar-user">{user?.email}</p>
					<button className="button button-secondary" type="button" onClick={onLogout} disabled={loggingOut}>
						{loggingOut ? 'Signing out...' : 'Log out'}
					</button>
				</header>
				<main className="content">
					{logoutError ? <Alert message={logoutError} /> : null}
					<Outlet />
				</main>
			</div>
		</div>
	);
}
