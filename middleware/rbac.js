// Requires the user to have the 'admin' role
export function requireAdmin(req, res, next) {
  if (req.session && req.session.role === 'admin') {
    return next();
  }
  return res.status(403).send('<h1>403 — Access Denied</h1><p>Admin access required.</p><a href="/">Go back</a>');
}

//export default {requireAdmin};