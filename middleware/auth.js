// Requires login — redirects to /login if not authenticated
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.redirect('/login');
}

// Redirects authenticated users away from login page
function redirectIfAuthed(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  return next();
}

module.exports = { requireAuth, redirectIfAuthed };