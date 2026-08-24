// Loading-state phrases for the /playing screen. Each state has a LIST of
// phrases, and every phrase is translated across all selector languages. The
// loader varies both the phrase and the language each tick (starting in
// English), so it never repeats the same thing — like Claude's cycling loaders.

export type LoadState = 'fetching' | 'translating';

// The order the loader steps through languages — English first, then the
// languages the app is really about, then the rest.
export const CYCLE_ORDER: string[] = [
  'en', 'sw', 'yo', 'ig', 'ha',
  'es', 'fr', 'pt', 'de', 'it', 'ar', 'hi', 'zh', 'ja', 'ko', 'ru', 'tr', 'th', 'vi', 'nl', 'pl', 'sv',
];

type Phrase = Record<string, string>;

export const LOADING_PHRASES: Record<LoadState, Phrase[]> = {
  fetching: [
    {
      en: 'Finding the lyrics', sw: 'Kutafuta maneno ya wimbo', yo: 'Ń wá ọ̀rọ̀ orin', ig: 'Na-achọ okwu abụ',
      ha: 'Ana neman kalmomin waƙa', es: 'Buscando la letra', fr: 'Recherche des paroles', pt: 'Procurando a letra',
      de: 'Songtext wird gesucht', it: 'Cerco il testo', ar: 'البحث عن كلمات الأغنية', hi: 'बोल ढूँढ रहे हैं',
      zh: '正在查找歌词', ja: '歌詞を探しています', ko: '가사를 찾는 중', ru: 'Ищем текст песни',
      tr: 'Şarkı sözleri aranıyor', th: 'กำลังค้นหาเนื้อเพลง', vi: 'Đang tìm lời bài hát', nl: 'Songtekst zoeken',
      pl: 'Szukanie tekstu', sv: 'Söker låttext',
    },
    {
      en: 'Looking for the words', sw: 'Kutafuta maneno', yo: 'Ń wá àwọn ọ̀rọ̀', ig: 'Na-achọ okwu',
      ha: 'Ana neman kalmomi', es: 'Buscando las palabras', fr: 'À la recherche des mots', pt: 'Procurando as palavras',
      de: 'Suche nach den Worten', it: 'In cerca delle parole', ar: 'البحث عن الكلمات', hi: 'शब्द ढूँढ रहे हैं',
      zh: '正在寻找词句', ja: '言葉を探しています', ko: '노랫말을 찾는 중', ru: 'Ищем слова',
      tr: 'Sözler aranıyor', th: 'กำลังค้นหาถ้อยคำ', vi: 'Đang tìm lời', nl: 'Op zoek naar de woorden',
      pl: 'Szukanie słów', sv: 'Letar efter orden',
    },
    {
      en: 'Getting the lyrics', sw: 'Kupata maneno ya wimbo', yo: 'Ń gba ọ̀rọ̀ orin', ig: 'Na-eweta okwu abụ',
      ha: 'Ana samo kalmomin waƙa', es: 'Obteniendo la letra', fr: 'Récupération des paroles', pt: 'Obtendo a letra',
      de: 'Songtext wird geladen', it: 'Recupero il testo', ar: 'جلب كلمات الأغنية', hi: 'बोल ला रहे हैं',
      zh: '正在获取歌词', ja: '歌詞を取得しています', ko: '가사를 가져오는 중', ru: 'Загружаем текст песни',
      tr: 'Şarkı sözleri alınıyor', th: 'กำลังดึงเนื้อเพลง', vi: 'Đang lấy lời bài hát', nl: 'Songtekst ophalen',
      pl: 'Pobieranie tekstu', sv: 'Hämtar låttext',
    },
    {
      en: 'Reading the lyrics', sw: 'Kusoma maneno ya wimbo', yo: 'Ń ka ọ̀rọ̀ orin', ig: 'Na-agụ okwu abụ',
      ha: 'Ana karanta kalmomin waƙa', es: 'Leyendo la letra', fr: 'Lecture des paroles', pt: 'Lendo a letra',
      de: 'Songtext wird gelesen', it: 'Leggo il testo', ar: 'قراءة كلمات الأغنية', hi: 'बोल पढ़ रहे हैं',
      zh: '正在读取歌词', ja: '歌詞を読み込んでいます', ko: '가사를 읽는 중', ru: 'Читаем текст песни',
      tr: 'Şarkı sözleri okunuyor', th: 'กำลังอ่านเนื้อเพลง', vi: 'Đang đọc lời bài hát', nl: 'Songtekst lezen',
      pl: 'Odczytywanie tekstu', sv: 'Läser låttext',
    },
  ],
  translating: [
    {
      en: 'Translating', sw: 'Inatafsiri', yo: 'Ń túmọ̀', ig: 'Na-atụgharị asụsụ',
      ha: 'Ana fassara', es: 'Traduciendo', fr: 'Traduction en cours', pt: 'Traduzindo',
      de: 'Übersetzen', it: 'Traduzione', ar: 'جارٍ الترجمة', hi: 'अनुवाद हो रहा है',
      zh: '正在翻译', ja: '翻訳しています', ko: '번역하는 중', ru: 'Переводим',
      tr: 'Çevriliyor', th: 'กำลังแปล', vi: 'Đang dịch', nl: 'Vertalen',
      pl: 'Tłumaczenie', sv: 'Översätter',
    },
    {
      en: 'Finding the meaning', sw: 'Kutafuta maana', yo: 'Ń wá ìtumọ̀', ig: 'Na-achọ ihe ọ pụtara',
      ha: "Ana neman ma'ana", es: 'Buscando el significado', fr: 'Recherche du sens', pt: 'Buscando o significado',
      de: 'Bedeutung wird gesucht', it: 'Cerco il significato', ar: 'البحث عن المعنى', hi: 'अर्थ ढूँढ रहे हैं',
      zh: '正在寻找含义', ja: '意味を読み解いています', ko: '의미를 찾는 중', ru: 'Ищем смысл',
      tr: 'Anlam aranıyor', th: 'กำลังค้นหาความหมาย', vi: 'Đang tìm ý nghĩa', nl: 'Betekenis zoeken',
      pl: 'Szukanie znaczenia', sv: 'Söker betydelsen',
    },
    {
      en: 'Understanding the song', sw: 'Kuelewa wimbo', yo: 'Ń lóye orin náà', ig: 'Na-aghọta abụ ahụ',
      ha: 'Ana fahimtar waƙa', es: 'Entendiendo la canción', fr: 'Compréhension de la chanson', pt: 'Entendendo a música',
      de: 'Das Lied wird verstanden', it: 'Capisco la canzone', ar: 'فهم الأغنية', hi: 'गाना समझ रहे हैं',
      zh: '正在理解这首歌', ja: '曲を理解しています', ko: '노래를 이해하는 중', ru: 'Понимаем песню',
      tr: 'Şarkı anlaşılıyor', th: 'กำลังทำความเข้าใจเพลง', vi: 'Đang hiểu bài hát', nl: 'Het lied begrijpen',
      pl: 'Rozumienie piosenki', sv: 'Förstår låten',
    },
    {
      en: 'Almost done', sw: 'Karibu kumaliza', yo: 'Ó ti fẹ́ parí', ig: 'Ọ fọdụrụ ntakịrị',
      ha: 'An kusa gamawa', es: 'Casi listo', fr: 'Presque terminé', pt: 'Quase pronto',
      de: 'Fast fertig', it: 'Quasi fatto', ar: 'أوشكنا على الانتهاء', hi: 'बस हो ही गया',
      zh: '就快好了', ja: 'もうすぐです', ko: '거의 다 됐어요', ru: 'Почти готово',
      tr: 'Neredeyse bitti', th: 'ใกล้เสร็จแล้ว', vi: 'Sắp xong rồi', nl: 'Bijna klaar',
      pl: 'Prawie gotowe', sv: 'Nästan klart',
    },
  ],
};
