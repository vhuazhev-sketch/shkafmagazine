// Основной скрипт для магазина «ШКАФ»
(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  // Инициализация темы Telegram
  if (tg) {
    tg.ready();
    tg.expand();
    const t = tg.themeParams || {};
    if (t.bg_color) document.documentElement.style.setProperty('--bg', t.bg_color);
    if (t.text_color) document.documentElement.style.setProperty('--text', t.text_color);
    if (t.button_color) document.documentElement.style.setProperty('--accent', t.button_color);
  }

  // Ссылки на страницы
  const pages = {
    mainPage: document.getElementById('mainPage'),
    productPage: document.getElementById('productPage'),
    reviewsPage: document.getElementById('reviewsPage'),
    supportPage: document.getElementById('supportPage'),
  };

  /**
   * Переключение страниц
   * @param {string} id
   */
  function setPage(id) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[id].classList.add('active');
    // Обновляем подсветку кнопок меню
    document.querySelectorAll('.tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === id);
    });
    // При просмотре товара всегда подсвечиваем главную вкладку
    if (id === 'productPage') {
      document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === 'mainPage');
      });
    }
    // Скроллим наверх
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Навигация по нижнему меню
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => setPage(btn.dataset.page));
  });

  // Список товаров
  const products = [
    { id: 'tee', name: 'Футболка', emoji: '👕', variants: ['👕','👚','🟦'], price: 990, reviews: 128, desc: 'Мягкая хлопковая футболка. Подходит на каждый день.' },
    { id: 'jeans', name: 'Джинсы', emoji: '👖', variants: ['👖','🟦','⬛️'], price: 1990, reviews: 64, desc: 'Классические джинсы прямого кроя. Удобная посадка.' },
    { id: 'jacket', name: 'Куртка', emoji: '🧥', variants: ['🧥','⬛️','🟫'], price: 3990, reviews: 57, desc: 'Тёплая куртка на прохладную погоду. Ветровлагозащита.' },
    { id: 'dress', name: 'Платье', emoji: '👗', variants: ['👗','🟥','🟪'], price: 2490, reviews: 91, desc: 'Лёгкое платье, отлично смотрится и днём и вечером.' },
    { id: 'cap', name: 'Кепка', emoji: '🧢', variants: ['🧢','🟦','⬛️'], price: 590, reviews: 33, desc: 'Бейсболка с регулируемой застёжкой.' },
    { id: 'sneakers', name: 'Кроссовки', emoji: '👟', variants: ['👟','⬜️','⬛️'], price: 2990, reviews: 142, desc: 'Удобные кроссовки для прогулок и спорта.' },
    { id: 'socks', name: 'Носки', emoji: '🧦', variants: ['🧦','⬜️','⬛️'], price: 190, reviews: 210, desc: 'Носки из хлопка. Комплект 1 пара.' },
    { id: 'bag', name: 'Сумка', emoji: '👜', variants: ['👜','🟫','⬛️'], price: 1490, reviews: 48, desc: 'Компактная сумка через плечо. Влезает всё нужное.' },
    { id: 'scarf', name: 'Шарф', emoji: '🧣', variants: ['🧣','🟥','🟩'], price: 790, reviews: 27, desc: 'Тёплый шарф. Мягкий и приятный к коже.' },
    { id: 'gloves', name: 'Перчатки', emoji: '🧤', variants: ['🧤','⬛️','🟫'], price: 690, reviews: 19, desc: 'Перчатки для прохладной погоды. Удобная посадка.' },
  ];

  // Отзывы
  const reviews = [
    { author: 'Алина', text: 'Очень стильные вещи!' },
    { author: 'Максим', text: 'Доставка быстрая, рекомендую.' },
    { author: 'Катя', text: 'Качество супер 🔥' },
    { author: 'Игорь', text: 'Нашёл идеальную куртку.' },
    { author: 'Мария', text: 'Буду заказывать ещё!' },
  ];

  // Функции для работы с режимом администратора
  function isAdmin() {
    return localStorage.getItem('isAdmin') === 'true';
  }
  function setAdmin(flag) {
    localStorage.setItem('isAdmin', flag ? 'true' : 'false');
  }

  // Получаем элементы DOM
  const grid = document.getElementById('productsGrid');
  const productEmoji = document.getElementById('productEmoji');
  const productVariants = document.getElementById('productVariants');
  const productNameEl = document.getElementById('productName');
  const productReviewsEl = document.getElementById('productReviews');
  const productPriceEl = document.getElementById('productPrice');
  const productDescEl = document.getElementById('productDesc');
  const backBtn = document.getElementById('backToCatalog');
  const buyBtn = document.getElementById('buyBtn');
  const reviewsContainer = document.getElementById('reviewsContainer');
  const leaveReviewBtn = document.getElementById('leaveReviewBtn');
  const adminLoginBtn = document.getElementById('adminLoginBtn');

  /**
   * Формирование цены
   * @param {number} n
   * @returns {string}
   */
  function rub(n) {
    return `${n}₽`;
  }

  /**
   * Рендер списка товаров
   */
  function renderGrid() {
    grid.innerHTML = '';
    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.dataset.id = p.id;
      card.innerHTML = `
        <div class="emoji">${p.emoji}</div>
        <div class="name">${p.name}</div>
        <div class="sub">отзывы: ${p.reviews} • ${rub(p.price)}</div>
      `;
      card.addEventListener('click', () => openProduct(p.id));
      grid.appendChild(card);
    });
    renderAdminPanel();
  }

  /**
   * Открыть конкретный товар
   * @param {string} id
   */
  function openProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    productEmoji.textContent = p.emoji;
    productNameEl.textContent = p.name;
    productVariants.innerHTML = '';
    p.variants.forEach(v => {
      const variant = document.createElement('div');
      variant.className = 'variant';
      variant.textContent = v;
      productVariants.appendChild(variant);
    });
    productReviewsEl.textContent = `Отзывы: ${p.reviews}`;
    productPriceEl.textContent = rub(p.price);
    productDescEl.textContent = p.desc;
    buyBtn.onclick = () => setPage('supportPage');
    setPage('productPage');
  }

  backBtn.addEventListener('click', () => setPage('mainPage'));

  /**
   * Отобразить отзывы
   */
  function renderReviews() {
    reviewsContainer.innerHTML = '';
    reviews.forEach(r => {
      const div = document.createElement('div');
      div.className = 'review-card';
      div.innerHTML = `<b>${r.author}</b><br>${r.text}`;
      reviewsContainer.appendChild(div);
    });
  }

  /**
   * Добавить отзыв (показывается всем пользователям)
   */
  function addReview() {
    const author = prompt('Ваше имя:');
    if (!author) return;
    const text = prompt('Ваш отзыв:');
    if (!text) return;
    reviews.push({ author, text });
    renderReviews();
    alert('Спасибо за ваш отзыв!');
  }

  leaveReviewBtn.addEventListener('click', addReview);

  /**
   * Вход администратора
   */
  function attemptAdminLogin() {
    const pwd = prompt('Введите пароль администратора:');
    if (!pwd) return;
    if (pwd === 'SpaceX26@') {
      setAdmin(true);
      alert('Администраторский режим активирован');
      renderGrid();
    } else {
      alert('Неверный пароль');
    }
  }
  adminLoginBtn.addEventListener('click', attemptAdminLogin);

  /**
   * Отрисовать кнопки и элементы для администратора
   */
  function renderAdminPanel() {
    // Удаляем прежнюю кнопку добавления товара, если она есть
    const existing = document.getElementById('addProductBtn');
    if (existing) existing.remove();
    if (!isAdmin()) return;
    const btn = document.createElement('button');
    btn.id = 'addProductBtn';
    btn.className = 'buy-btn';
    btn.textContent = 'Добавить товар';
    btn.style.marginTop = '14px';
    btn.addEventListener('click', addProduct);
    // Добавляем после сетки каталога
    grid.parentNode.appendChild(btn);
  }

  /**
   * Добавление товара (для администратора). Данные вводятся через простые окна.
   */
  function addProduct() {
    const name = prompt('Название товара:');
    if (!name) return;
    const emojiOrImg = prompt('Эмодзи или ссылка на фото (пример: 👕):');
    if (!emojiOrImg) return;
    const priceInput = prompt('Цена (руб.):');
    const price = parseInt(priceInput, 10);
    if (isNaN(price)) {
      alert('Цена должна быть числом');
      return;
    }
    const desc = prompt('Описание товара:') || '';
    const reviewsCountInput = prompt('Количество отзывов (число):');
    const reviewsCount = parseInt(reviewsCountInput, 10);
    if (isNaN(reviewsCount)) {
      alert('Количество отзывов должно быть числом');
      return;
    }
    const variantsInput = prompt('Варианты (эмодзи через запятую, например: 👕,👚,🟦)');
    const variants = variantsInput ? variantsInput.split(',').map(s => s.trim()).filter(Boolean) : [emojiOrImg];
    const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    products.push({ id, name, emoji: emojiOrImg, variants, price, reviews: reviewsCount, desc });
    renderGrid();
    alert('Товар добавлен');
  }

  // Первоначальный рендер
  renderGrid();
  renderReviews();
  setPage('mainPage');
})();