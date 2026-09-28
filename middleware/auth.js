// Requires login — redirects to /login if not authenticated
export function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/login');
}

// Redirects authenticated users away from login page
export function redirectIfAuthed(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  return next();
}

export default { requireAuth, redirectIfAuthed };
