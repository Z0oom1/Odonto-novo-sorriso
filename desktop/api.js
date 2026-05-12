const API_URL = `http://${window.location.hostname}:3000/api`;

const api = {
    async getData() {
        const res = await fetch(`${API_URL}/data?t=${Date.now()}`, { cache: 'no-store' });
        return await res.json();
    },
    async save(store, data) {
        const res = await fetch(`${API_URL}/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store, data })
        });
        return await res.json();
    },
    async delete(store, id) {
        const res = await fetch(`${API_URL}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ store, id })
        });
        return await res.json();
    },
    async login(user, pass) {
        const res = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user, pass })
        });
        return await res.json();
    }
};
