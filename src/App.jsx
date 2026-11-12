/** Route table for the ZYREX STORE storefront and admin dashboard. */
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { ErrorBoundary, RequireAdmin, RequireAuth, ScrollToTop } from './components/guards';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Categories from './pages/Categories';
import Product from './pages/Product';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Compare from './pages/Compare';
import Checkout from './pages/Checkout';
import { Login, Register, ForgotPassword, ResetPassword } from './pages/Auth';
import Account, { AccountProfile, AccountAddresses, AccountSettings } from './pages/Account';
import { Orders, OrderDetail, Track } from './pages/Orders';
import { Blog, BlogPost, Vlog, Faq, Help, Contact, About, Policy } from './pages/Content';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <ErrorBoundary>
      <ScrollToTop />
      <Routes>
        <Route
          path="/admin/*"
          element={
            <Routes>
              <Route path="login" element={<AdminLogin />} />
              <Route element={<RequireAdmin />}>
                <Route path="*" element={<Admin />} />
              </Route>
            </Routes>
          }
        />
        <Route
          path="*"
          element={
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop mode="shop" />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/category/:slug" element={<Shop mode="category" />} />
                <Route path="/search" element={<Shop mode="search" />} />
                <Route path="/deals" element={<Shop mode="deals" />} />
                <Route path="/product/:slug" element={<Product />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/checkout" element={<RequireAuth><Checkout /></RequireAuth>} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/account" element={<RequireAuth><Account /></RequireAuth>}>
                  <Route index element={<AccountProfile />} />
                  <Route path="addresses" element={<AccountAddresses />} />
                  <Route path="settings" element={<AccountSettings />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="orders/:id" element={<OrderDetail />} />
                </Route>
                <Route path="/track" element={<Track />} />
                <Route path="/blog" element={<Blog />} />
                <Route path="/blog/:slug" element={<BlogPost />} />
                <Route path="/vlog" element={<Vlog />} />
                <Route path="/faq" element={<Faq />} />
                <Route path="/help" element={<Help />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/about" element={<About />} />
                <Route path="/shipping-policy" element={<Policy kind="shipping" />} />
                <Route path="/return-policy" element={<Policy kind="returns" />} />
                <Route path="/privacy-policy" element={<Policy kind="privacy" />} />
                <Route path="/terms" element={<Policy kind="terms" />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}
