# OAZIS Landing

Oazis chet tili o'quv platformasining landing (marketing) sahifasi.

Stack: Vite + React 19 + TypeScript + TailwindCSS v4 (`@tailwindcss/vite`), lucide-react ikonlar, axios.

## Ishga tushirish

```bash
npm install
npm run dev      # http://localhost:3100
```

Prod build:

```bash
npm run build
npm run preview
```

## Muhit sozlamalari (.env)

`.env.example` faylini `.env` ga nusxalang:

```
VITE_API_BASE_URL=http://localhost:8080
```

- `VITE_API_BASE_URL` — backend manzili (default `http://localhost:8080`).

## Backend integratsiyasi

- Sahifa ochilganda `GET {API_BASE}/api/landing` dan kontent olishga urinadi.
  Agar so'rov muvaffaqiyatsiz bo'lsa, `src/data/landing.ts` dagi statik kontent
  ishlatiladi — shunda backend bo'lmasa ham sahifa to'liq ishlaydi.
- Ro'yxatdan o'tish formasi `POST {API_BASE}/api/landing/leads` ga
  `{ firstName, lastName, phone }` JSON yuboradi.

## Struktura

- `src/data/landing.ts` — tipli statik kontent (stats, features, courses, ...).
- `src/lib/api.ts` — backend so'rovlari + fallback.
- `src/components/ui/` — qayta ishlatiladigan komponentlar (Section, Container, Button, CourseCard, FeatureCard).
- `src/components/sections/` — har bir sahifa bo'limi alohida komponent.
