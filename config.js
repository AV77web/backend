const isProduction = process.env.NODE_ENV === 'production';

const FRONTEND_URL = isProduction
    ? "https://frontend-phi-three-71.vercel.app"
    : "http://localhost:5173";

module.exports = {
    FRONTEND_URL
};