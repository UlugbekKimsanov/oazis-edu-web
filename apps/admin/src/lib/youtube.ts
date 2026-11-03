// YouTube havola/ID parseri — dars formasida admin to'liq URL yopishtirsa ham
// undan 11 belgili video ID ajratib olinadi.

// YouTube video ID — har doim 11 belgi: harf, raqam, '-' va '_'.
const YT_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

// Qo'llanadigan URL ko'rinishlari:
//   youtu.be/<id>
//   youtube.com/watch?v=<id>  (v= boshqa parametrlardan keyin kelsa ham)
//   youtube.com/shorts/<id>
//   youtube.com/embed/<id>
//   youtube.com/live/<id>
// www./m. prefikslari va http(s) bilan ham ishlaydi.
const YT_URL_RE =
  /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/))([a-zA-Z0-9_-]{11})/i;

/**
 * Kiritilgan matndan YouTube video ID ajratadi.
 * Toza 11 belgili ID yoki tanish URL bo'lsa — ID, aks holda null.
 */
export function parseYoutubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (YT_ID_RE.test(s)) return s;
  const m = s.match(YT_URL_RE);
  return m ? m[1] : null;
}

/** ID'dan qisqa kanonik havola — formada mavjud qiymatni ko'rsatish uchun. */
export const youtubeUrl = (id: string) => `https://youtu.be/${id}`;
