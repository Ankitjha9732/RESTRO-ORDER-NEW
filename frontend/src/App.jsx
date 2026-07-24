import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiShoppingCart, FiStar } from 'react-icons/fi';
import { Link, Route, Routes } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const socket = io(SOCKET_URL);

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
};

const categories = ['Pizza', 'Burger', 'Chinese', 'Indian', 'Desserts', 'Drinks', 'Fast Food'];

const fallbackFoods = [
  { _id: '1', name: 'Smoked Truffle Pizza', description: 'Wood-fired crust with truffle cream and mushrooms', category: 'Pizza', price: 480, rating: 4.8, preparationTime: 20, veg: true, available: true },
  { _id: '2', name: 'Classic Chicken Burger', description: 'Grilled chicken patty with cheddar and slaw', category: 'Burger', price: 320, rating: 4.5, preparationTime: 15, veg: false, available: true },
  { _id: '3', name: 'Kung Pao Noodles', description: 'Wok-tossed noodles with crisp vegetables and peanuts', category: 'Chinese', price: 290, rating: 4.6, preparationTime: 18, veg: true, available: true },
  { _id: '4', name: 'Paneer Butter Masala', description: 'Creamy tomato-based curry with soft paneer cubes', category: 'Indian', price: 260, rating: 4.7, preparationTime: 20, veg: true, available: true },
  { _id: '5', name: 'Chocolate Lava Cake', description: 'Warm dessert with molten chocolate core', category: 'Desserts', price: 220, rating: 4.9, preparationTime: 10, veg: true, available: true },
  { _id: '6', name: 'Mango Smoothie', description: 'Fresh mango blend with a hint of cardamom', category: 'Drinks', price: 180, rating: 4.4, preparationTime: 8, veg: true, available: true },
  { _id: '7', name: 'Loaded Fries', description: 'Golden fries topped with cheese and herbs', category: 'Fast Food', price: 190, rating: 4.3, preparationTime: 12, veg: true, available: true }
];

function App() {
  const [foods, setFoods] = useState([]);
  const [cart, setCart] = useState([]);
  const [tableNumber, setTableNumber] = useState(1);
  const [orders, setOrders] = useState([]);
  const [auth, setAuth] = useState({ token: localStorage.getItem('token') || '', user: getStoredUser() });
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [mode, setMode] = useState('dark');
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [newFood, setNewFood] = useState({
    name: '',
    description: '',
    category: 'Pizza',
    price: '',
    rating: '4.5',
    preparationTime: '15',
    veg: true,
    available: true
  });

  useEffect(() => {
    axios.get(`${API_URL}/foods`)
      .then(({ data }) => {
        // FIXED: Ensure we always set an array
        setFoods(Array.isArray(data) && data.length > 0 ? data : fallbackFoods);
      })
      .catch(() => {
        setFoods(fallbackFoods);
      });
  }, []);

  useEffect(() => {
    if (!auth.token) {
      setOrders([]);
      return;
    }
    setLoadingOrders(true);
    axios.get(`${API_URL}/orders`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
      .then(({ data }) => setOrders(data))
      .catch(() => setOrders([]))
      .finally(() => setLoadingOrders(false));
  }, [auth.token]);

  useEffect(() => {
    const onNewOrder = (order) => setOrders((prev) => [order, ...prev]);
    const onStatusUpdate = ({ order }) => setOrders((prev) => prev.map((item) => item._id === order._id ? order : item));
    socket.on('new-order', onNewOrder);
    socket.on('status-update', onStatusUpdate);
    return () => {
      socket.off('new-order', onNewOrder);
      socket.off('status-update', onStatusUpdate);
    };
  }, []);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const gst = subtotal * 0.18;
    const service = subtotal * 0.1;
    return { subtotal, gst, service, grand: subtotal + gst + service };
  }, [cart]);

  const addToCart = (food) => {
    setCart((prev) => {
      const existing = prev.find((item) => item._id === food._id);
      if (existing) return prev.map((item) => item._id === food._id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...food, quantity: 1 }];
    });
  };

  const updateQuantity = (id, delta) => {
    setCart((prev) => prev.flatMap((item) => item._id === id ? (item.quantity + delta > 0 ? [{ ...item, quantity: item.quantity + delta }] : []) : [item]));
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      alert('Add items to your cart before placing an order');
      return;
    }
    try {
      const payload = {
        tableNumber,
        customerName: auth.user?.name || 'Guest',
        items: cart.map((item) => ({ name: item.name, price: item.price, quantity: item.quantity, notes: item.notes || '' })),
        total: totals.grand,
        status: 'Received',
        paymentMethod: 'Cash',
        notes: 'Fresh and fast',
        estimatedTime: 20
      };
      const { data } = await axios.post(`${API_URL}/orders`, payload);
      setOrders((prev) => [data, ...prev]);
      setCart([]);
      alert('Order placed successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to place order. Make sure the backend server is running.');
    }
  };

  const login = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const payload = { email: form.get('email'), password: form.get('password') };
    try {
      const { data } = await axios.post(`${API_URL}/auth/login`, payload);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setAuth({ token: data.token, user: data.user });
      setAuthError('');
      alert('Logged in');
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed';
      setAuthError(message);
      alert(message);
    }
  };

  const handleCustomerAuth = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const email = form.get('email');
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (authMode === 'signup' && password !== confirmPassword) {
      setAuthError('Passwords do not match');
      return;
    }
    const endpoint = authMode === 'signup' ? `${API_URL}/auth/signup` : `${API_URL}/auth/login`;
    const payload = authMode === 'signup'
      ? { name: form.get('name'), email, password, role: 'customer' }
      : { email, password };
    try {
      const { data } = await axios.post(endpoint, payload);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setAuth({ token: data.token, user: data.user });
      setAuthError('');
      alert(authMode === 'signup' ? 'Account created successfully' : 'Logged in');
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Authentication failed');
      alert(err.response?.data?.message || 'Authentication failed');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setAuth({ token: '', user: null });
    setOrders([]);
  };

  const updateOrderStatus = async (id, status) => {
    try {
      const { data } = await axios.patch(`${API_URL}/orders/${id}`, { status }, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setOrders((prev) => prev.map((order) => order._id === id ? data : order));
    } catch {
      alert('Unable to update status');
    }
  };

  const addFood = async (e) => {
    e.preventDefault();
    if (!auth.token || auth.user?.role !== 'admin') {
      alert('Only admins can add menu items');
      return;
    }
    try {
      const payload = {
        ...newFood,
        price: Number(newFood.price),
        rating: Number(newFood.rating),
        preparationTime: Number(newFood.preparationTime),
        veg: Boolean(newFood.veg),
        available: Boolean(newFood.available)
      };
      const { data } = await axios.post(`${API_URL}/foods`, payload, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      setFoods((prev) => [data, ...prev]);
      setNewFood({
        name: '',
        description: '',
        category: 'Pizza',
        price: '',
        rating: '4.5',
        preparationTime: '15',
        veg: true,
        available: true
      });
      alert('Menu item added successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to add menu item');
    }
  };

  // FIXED: Safe filtering with fallback
  const filteredFoods = Array.isArray(foods) 
    ? foods.filter((food) => {
        const matchesCategory = filter === 'All' || food.category === filter;
        const matchesSearch = food.name.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
      })
    : [];

  return (
    <div className={mode === 'dark' ? 'min-h-screen bg-slate-950 text-slate-100' : 'min-h-screen bg-stone-50 text-slate-900'}>
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-amber-400">Culinary QR</p>
            <h1 className="text-xl font-semibold">The Grand Table</h1>
          </div>
          <nav className="hidden gap-6 md:flex">
            <Link to="/" className="hover:text-amber-400">Home</Link>
            <Link to="/menu" className="hover:text-amber-400">Menu</Link>
            <Link to="/account" className="hover:text-amber-400">Account</Link>
            <Link to="/admin" className="hover:text-amber-400">Admin</Link>
          </nav>
          <div className="flex items-center gap-3">
            <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')} className="rounded-full border px-3 py-2">{mode === 'dark' ? '☀️' : '🌙'}</button>
            <button className="rounded-full bg-amber-500 p-3 text-slate-950"><FiShoppingCart /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/menu" element={
            <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
              <section className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setFilter('All')} className={`rounded-full px-4 py-2 ${filter === 'All' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800'}`}>All</button>
                  {categories.map((category) => <button key={category} onClick={() => setFilter(category)} className={`rounded-full px-4 py-2 ${filter === category ? 'bg-amber-500 text-slate-950' : 'bg-slate-800'}`}>{category}</button>)}
                </div>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search dishes" className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3" />
                <div className="grid gap-4 md:grid-cols-2">
                  {filteredFoods.map((food) => (
                    <motion.div key={food._id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="mb-4 flex items-center justify-between">
                        <span className={`rounded-full px-3 py-1 text-xs ${food.veg ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>{food.veg ? 'Veg' : 'Non Veg'}</span>
                        <span className="text-sm text-amber-400">⭐ {food.rating}</span>
                      </div>
                      <h3 className="text-lg font-semibold">{food.name}</h3>
                      <p className="mt-2 text-sm text-slate-400">{food.description}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <div>
                          <p className="text-xl font-semibold">₹{food.price}</p>
                          <p className="text-xs text-slate-400">{food.preparationTime} min</p>
                        </div>
                        <button onClick={() => addToCart(food)} className="rounded-full bg-amber-500 px-4 py-2 font-medium text-slate-950">Add</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
              {/* ... rest of your cart aside remains unchanged ... */}
              <aside className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Your Cart</h2>
                  <div className="rounded-full bg-amber-500 px-3 py-1 text-sm text-slate-950">Table {tableNumber}</div>
                </div>
                <label className="mb-4 block text-sm text-slate-400">
                  Table number
                  <input
                    type="number"
                    min="1"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(Number(e.target.value || 1))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-100"
                  />
                </label>
                {cart.length === 0 ? <p className="text-slate-400">Your cart is empty.</p> : cart.map((item) => <div key={item._id} className="mb-3 rounded-2xl border border-white/10 p-3"><div className="flex items-center justify-between"><div><p className="font-medium">{item.name}</p><p className="text-sm text-slate-400">₹{item.price}</p></div><div className="flex items-center gap-2"><button onClick={() => updateQuantity(item._id, -1)} className="rounded-full bg-slate-800 px-2">-</button><span>{item.quantity}</span><button onClick={() => updateQuantity(item._id, 1)} className="rounded-full bg-slate-800 px-2">+</button></div></div></div>)}
                <div className="mt-6 space-y-2 text-sm text-slate-400">
                  <div className="flex justify-between"><span>Subtotal</span><span>₹{totals.subtotal.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>GST</span><span>₹{totals.gst.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span>Service</span><span>₹{totals.service.toFixed(2)}</span></div>
                  <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold text-white"><span>Total</span><span>₹{totals.grand.toFixed(2)}</span></div>
                </div>
                <button onClick={placeOrder} className="mt-6 w-full rounded-full bg-amber-500 px-4 py-3 font-semibold text-slate-950">Place Order</button>
              </aside>
            </div>
          } />
          <Route path="/account" element={<AccountPage auth={auth} authMode={authMode} setAuthMode={setAuthMode} authError={authError} handleCustomerAuth={handleCustomerAuth} logout={logout} />} />
          <Route path="/admin" element={<AdminPanel auth={auth} login={login} orders={orders} logout={logout} updateOrderStatus={updateOrderStatus} loadingOrders={loadingOrders} addFood={addFood} newFood={newFood} setNewFood={setNewFood} />} />
        </Routes>
      </main>
    </div>
  );
}

// All other components (LandingPage, AccountPage, AdminPanel) remain exactly the same
function LandingPage() {
  return (
    <div className="space-y-8">
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950 p-8 shadow-2xl">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.35em] text-amber-400">QR Dining Experience</p>
            <h2 className="text-4xl font-semibold sm:text-6xl">Order from your table in seconds.</h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-300">The Grand Table brings premium dining, instant ordering, and live kitchen updates to every table.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/menu" className="rounded-full bg-amber-500 px-5 py-3 font-semibold text-slate-950">Browse Menu</Link>
              <Link to="/account" className="rounded-full border border-white/15 px-5 py-3">Create Account</Link>
              <Link to="/admin" className="rounded-full border border-white/15 px-5 py-3">Admin Dashboard</Link>
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
            <p className="text-sm uppercase tracking-[0.35em] text-amber-400">Today&apos;s special</p>
            <h3 className="mt-2 text-2xl font-semibold">Smoked Truffle Pizza</h3>
            <p className="mt-3 text-slate-400">Wood-fired crust, mozzarella, truffle cream, and wild mushrooms.</p>
            <div className="mt-6 flex items-center gap-2 text-amber-400"><FiStar /><FiStar /><FiStar /><FiStar /></div>
          </div>
        </div>
      </motion.section>
      <section className="grid gap-4 md:grid-cols-3">
        {['Popular Dishes', 'Warm Hospitality', 'Live Kitchen Updates'].map((item) => <div key={item} className="rounded-3xl border border-white/10 bg-slate-900/60 p-5"><h3 className="text-xl font-semibold">{item}</h3><p className="mt-2 text-slate-400">Crafted for speed, flavor, and a premium guest experience.</p></div>)}
      </section>
    </div>
  );
}

function AccountPage({ auth, authMode, setAuthMode, authError, handleCustomerAuth, logout }) {
  return (
    <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
      {!auth.token ? (
        <>
          <div className="flex gap-3">
            <button onClick={() => setAuthMode('login')} className={`rounded-full px-4 py-2 ${authMode === 'login' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800'}`}>Login</button>
            <button onClick={() => setAuthMode('signup')} className={`rounded-full px-4 py-2 ${authMode === 'signup' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800'}`}>Sign up</button>
          </div>
          <form onSubmit={handleCustomerAuth} className="mt-6 space-y-4">
            {authMode === 'signup' && <input name="name" type="text" placeholder="Full name" required className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />}
            <input name="email" type="email" placeholder="Email" required className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
            <input name="password" type="password" placeholder="Password" required className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
            {authMode === 'signup' && <input name="confirmPassword" type="password" placeholder="Confirm password" required className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />}
            {authError && <p className="text-sm text-rose-400">{authError}</p>}
            <button className="w-full rounded-full bg-amber-500 px-4 py-3 font-semibold text-slate-950">{authMode === 'signup' ? 'Create account' : 'Login'}</button>
          </form>
        </>
      ) : (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Welcome, {auth.user?.name || 'Guest'}</h2>
          <p className="text-slate-400">You’re signed in and can place orders faster with your saved profile.</p>
          <button onClick={logout} className="rounded-full border border-white/10 px-4 py-2">Logout</button>
        </div>
      )}
    </div>
  );
}

function AdminPanel({ auth, login, orders, logout, updateOrderStatus, loadingOrders, addFood, newFood, setNewFood }) {
  const isAdmin = auth.user?.role === 'admin';
  const statusOptions = ['Received', 'Preparing', 'Ready', 'Served'];
  const revenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const pendingCount = orders.filter((order) => order.status !== 'Served').length;
  const completedCount = orders.filter((order) => order.status === 'Served').length;
  return (
    <div className="space-y-6">
      {!auth.token || !isAdmin ? (
        <form onSubmit={login} className="mx-auto max-w-md rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-2xl font-semibold">Admin Login</h2>
          <p className="mt-2 text-sm text-slate-400">Contact the restaurant owner for admin credentials.</p>
          <input name="email" type="email" placeholder="Email" className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
          <input name="password" type="password" placeholder="Password" className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
          <button className="mt-6 w-full rounded-full bg-amber-500 px-4 py-3 font-semibold text-slate-950">Sign In</button>
        </form>
      ) : (
        <div>
          <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-900/70 p-5">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-amber-400">Kitchen Control</p>
              <h2 className="text-2xl font-semibold">Welcome, {auth.user?.name || 'Admin'}</h2>
            </div>
            <button onClick={logout} className="rounded-full border border-white/10 px-4 py-2 text-sm">Logout</button>
          </div>
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Add Menu Item</h3>
              <span className="text-sm text-slate-400">Admin only</span>
            </div>
            <form onSubmit={addFood} className="mt-4 grid gap-3 md:grid-cols-2">
              <input value={newFood.name} onChange={(e) => setNewFood({ ...newFood, name: e.target.value })} placeholder="Item name" required className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
              <input value={newFood.price} onChange={(e) => setNewFood({ ...newFood, price: e.target.value })} type="number" min="1" placeholder="Price" required className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
              <textarea value={newFood.description} onChange={(e) => setNewFood({ ...newFood, description: e.target.value })} placeholder="Description" required className="md:col-span-2 min-h-24 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
              <select value={newFood.category} onChange={(e) => setNewFood({ ...newFood, category: e.target.value })} className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
                {categories.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
              <input value={newFood.rating} onChange={(e) => setNewFood({ ...newFood, rating: e.target.value })} type="number" step="0.1" min="1" max="5" placeholder="Rating" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
              <input value={newFood.preparationTime} onChange={(e) => setNewFood({ ...newFood, preparationTime: e.target.value })} type="number" min="1" placeholder="Prep time" className="rounded-2xl border border-white/10 bg-slate-950 px-4 py-3" />
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
                <input type="checkbox" checked={newFood.veg} onChange={(e) => setNewFood({ ...newFood, veg: e.target.checked })} />
                Vegetarian
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3">
                <input type="checkbox" checked={newFood.available} onChange={(e) => setNewFood({ ...newFood, available: e.target.checked })} />
                Available
              </label>
              <button className="md:col-span-2 rounded-full bg-amber-500 px-4 py-3 font-semibold text-slate-950">Add item to menu</button>
            </form>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-lg font-semibold">Today&apos;s Orders</h3>
              <p className="mt-2 text-2xl font-semibold text-amber-400">{orders.length}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-lg font-semibold">Revenue</h3>
              <p className="mt-2 text-2xl font-semibold text-amber-400">₹{revenue.toLocaleString('en-IN')}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-lg font-semibold">Pending Orders</h3>
              <p className="mt-2 text-2xl font-semibold text-amber-400">{pendingCount}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5">
              <h3 className="text-lg font-semibold">Completed Orders</h3>
              <p className="mt-2 text-2xl font-semibold text-amber-400">{completedCount}</p>
            </div>
          </div>
          <div className="mt-6 rounded-3xl border border-white/10 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Live Orders</h3>
              {loadingOrders && <p className="text-sm text-slate-400">Refreshing…</p>}
            </div>
            <div className="mt-4 space-y-3">
              {orders.length === 0 ? (
                <p className="text-sm text-slate-400">No orders yet. New ones will appear here instantly.</p>
              ) : orders.map((order) => (
                <div key={order._id} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-medium">Table {order.tableNumber} • {order.customerName}</p>
                      <p className="text-sm text-slate-400">{order.items?.map((item) => `${item.name} x${item.quantity}`).join(', ')}</p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-amber-400">{order.status}</p>
                      <p className="text-sm text-slate-400">₹{order.total}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {statusOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => updateOrderStatus(order._id, status)}
                        className={`rounded-full px-3 py-1 text-sm ${order.status === status ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;