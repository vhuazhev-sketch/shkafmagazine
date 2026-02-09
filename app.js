// Скрипт магазина с поиском, сортировкой и локальным хранилищем
(function () {
  const tg = window.Telegram && window.Telegram.WebApp;
  // Настройка темы Telegram
  if (tg) {
    tg.ready();
    tg.expand();
    const t = tg.themeParams || {};
    if (t.bg_color) document.documentElement.style.setProperty('--bg', t.bg_color);
    if (t.text_color) document.documentElement.style.setProperty('--text', t.text_color);
    if (t.button_color) document.documentElement.style.setProperty('--accent', t.button_color);
  }

  // Указатели на страницы
  const pages = {
    mainPage: document.getElementById('mainPage'),
    productPage: document.getElementById('productPage'),
    supportPage: document.getElementById('supportPage'),
  };

  /**
   * Переключение страницы
   * @param {string} id 
   */
  function setPage(id) {
    Object.values(pages).forEach(p => p.classList.remove('active'));
    pages[id].classList.add('active');
    document.querySelectorAll('.tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === id);
    });
    if (id === 'productPage') {
      document.querySelectorAll('.tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.page === 'mainPage');
      });
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // Навигация через нижние кнопки
  document.querySelectorAll('.tab').forEach(btn => {
    btn.addEventListener('click', () => setPage(btn.dataset.page));
  });

  // Хранилище продуктов в localStorage
  const defaultProducts = [
    { id: 'tee', name: 'Футболка', emoji: '👕', variants: ['👕','👚','🟦'], price: 990, desc: 'Мягкая хлопковая футболка. Подходит на каждый день.', reviews: [] },
    { id: 'jeans', name: 'Джинсы', emoji: '👖', variants: ['👖','🟦','⬛️'], price: 1990, desc: 'Классические джинсы прямого кроя. Удобная посадка.', reviews: [] },
    { id: 'jacket', name: 'Куртка', emoji: '🧥', variants: ['🧥','⬛️','🟫'], price: 3990, desc: 'Тёплая куртка на прохладную погоду. Ветровлагозащита.', reviews: [] },
    { id: 'dress', name: 'Платье', emoji: '👗', variants: ['👗','🟥','🟪'], price: 2490, desc: 'Лёгкое платье, отлично смотрится и днём и вечером.', reviews: [] },
    { id: 'cap', name: 'Кепка', emoji: '🧢', variants: ['🧢','🟦','⬛️'], price: 590, desc: 'Бейсболка с регулируемой застёжкой.', reviews: [] },
    { id: 'sneakers', name: 'Кроссовки', emoji: '👟', variants: ['👟','⬜️','⬛️'], price: 2990, desc: 'Удобные кроссовки для прогулок и спорта.', reviews: [] },
    { id: 'socks', name: 'Носки', emoji: '🧦', variants: ['🧦','⬜️','⬛️'], price: 190, desc: 'Носки из хлопка. Комплект 1 пара.', reviews: [] },
    { id: 'bag', name: 'Сумка', emoji: '👜', variants: ['👜','🟫','⬛️'], price: 1490, desc: 'Компактная сумка через плечо. Влезает всё нужное.', reviews: [] },
    { id: 'scarf', name: 'Шарф', emoji: '🧣', variants: ['🧣','🟥','🟩'], price: 790, desc: 'Тёплый шарф. Мягкий и приятный к коже.', reviews: [] },
    { id: 'gloves', name: 'Перчатки', emoji: '🧤', variants: ['🧤','⬛️','🟫'], price: 690, desc: 'Перчатки для прохладной погоды. Удобная посадка.', reviews: [] },
  ];

  let products = [];
  const stored = localStorage.getItem('products_db');
  if (stored) {
    try {
      products = JSON.parse(stored);
    } catch {
      products = defaultProducts;
    }
  } else {
    products = defaultProducts;
  }

  /**
   * Сохраняет продукты в localStorage
   */
  function saveProducts() {
    localStorage.setItem('products_db', JSON.stringify(products));
  }

  // Хранилище админа
  function isAdmin() { return localStorage.getItem('isAdmin') === 'true'; }
  function setAdmin(flag) { localStorage.setItem('isAdmin', flag ? 'true' : 'false'); }

  // DOM элементы
  const grid = document.getElementById('productsGrid');
  const searchInput = document.getElementById('searchInput');
  const sortBtn = document.getElementById('sortBtn');
  const backBtn = document.getElementById('backToCatalog');
  const productImg = document.getElementById('productImg');
  const productVariants = document.getElementById('productVariants');
  const productNameEl = document.getElementById('productName');
  const productReviewCount = document.getElementById('productReviewCount');
  const productPriceEl = document.getElementById('productPrice');
  const productDescEl = document.getElementById('productDesc');
  const productReviewsEl = document.getElementById('productReviews');
  const productReviewBtn = document.getElementById('productReviewBtn');
  const adminActions = document.getElementById('adminActions');
  const imageUploadInput = document.getElementById('imageUpload');
  const adminLoginBtn = document.getElementById('adminLoginBtn');

  // Состояние поиска и сортировки
  let searchQuery = '';
  let sortAscending = true;
  let currentProduct = null;

  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value.toLowerCase();
    renderGrid();
  });

  sortBtn.addEventListener('click', () => {
    sortAscending = !sortAscending;
    // Меняем иконку на кнопке: стрелка вверх/вниз или разные эмодзи
    sortBtn.textContent = sortAscending ? '🔽' : '🔼';
    renderGrid();
  });

  backBtn.addEventListener('click', () => {
    currentProduct = null;
    setPage('mainPage');
  });

  // Admin login
  adminLoginBtn.addEventListener('click', () => {
    const pwd = prompt('Введите пароль администратора:');
    if (!pwd) return;
    if (pwd === 'SpaceX26@') {
      setAdmin(true);
      alert('Администраторский режим активирован');
      renderGrid();
    } else {
      alert('Неверный пароль');
    }
  });

  /**
   * Рендерит список товаров, учитывая поиск и сортировку
   */
  function renderGrid() {
    grid.innerHTML = '';
    let filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery));
    filtered.sort((a, b) => sortAscending ? a.price - b.price : b.price - a.price);
    filtered.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      card.dataset.id = p.id;
      // изображение: либо dataURI, либо эмодзи
      let imgHTML;
      if (p.imageData) {
        imgHTML = `<img src="${p.imageData}" alt="${p.name}">`;
      } else {
        imgHTML = `<span class="emoji">${p.emoji}</span>`;
      }
      card.innerHTML = `
        <div class="img-wrap">${imgHTML}</div>
        <div class="name">${p.name}</div>
        <div class="sub">отзывы: ${p.reviews.length} • ${p.price}₽</div>
      `;
      card.addEventListener('click', () => {
        openProduct(p.id);
      });
      grid.appendChild(card);
    });
  }

  /**
   * Открывает страницу товара
   * @param {string} id 
   */
  function openProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    currentProduct = p;
    renderProduct();
    setPage('productPage');
  }

  /**
   * Рендерит текущий товар на странице
   */
  function renderProduct() {
    const p = currentProduct;
    if (!p) return;
    // Изображение или эмодзи
    productImg.innerHTML = '';
    if (p.imageData) {
      const imgEl = document.createElement('img');
      imgEl.src = p.imageData;
      productImg.appendChild(imgEl);
    } else {
      productImg.textContent = p.emoji;
    }
    // Варианты
    productVariants.innerHTML = '';
    p.variants.forEach(v => {
      const variant = document.createElement('div');
      variant.className = 'variant';
      // если вариант выглядит как dataURI, показываем как изображение
      if (v.startsWith('data:') || v.startsWith('http')) {
        const img = document.createElement('img');
        img.src = v;
        variant.appendChild(img);
      } else {
        variant.textContent = v;
      }
      variant.addEventListener('click', () => {
        // меняем главное изображение
        if (v.startsWith('data:') || v.startsWith('http')) {
          productImg.innerHTML = '';
          const imgEl = document.createElement('img');
          imgEl.src = v;
          productImg.appendChild(imgEl);
        } else {
          productImg.textContent = v;
        }
      });
      productVariants.appendChild(variant);
    });
    // Название, цена, отзывы, описание
    productNameEl.textContent = p.name;
    productPriceEl.textContent = `${p.price}₽`;
    productReviewCount.textContent = `Отзывы: ${p.reviews.length}`;
    productDescEl.textContent = p.desc;
    // Отзывы
    renderProductReviews();
    // Кнопки администратора
    renderAdminActions();
  }

  /**
   * Рендерит отзывы текущего товара
   */
  function renderProductReviews() {
    productReviewsEl.innerHTML = '';
    const p = currentProduct;
    if (!p) return;
    if (p.reviews.length === 0) {
      const none = document.createElement('div');
      none.className = 'review-card';
      none.textContent = 'Пока нет отзывов';
      productReviewsEl.appendChild(none);
    } else {
      p.reviews.forEach(r => {
        const div = document.createElement('div');
        div.className = 'review-card';
        div.innerHTML = `<b>${r.author}</b><br>${r.text}`;
        productReviewsEl.appendChild(div);
      });
    }
  }

  // Кнопка оставить отзыв
  productReviewBtn.addEventListener('click', () => {
    if (!currentProduct) return;
    const author = prompt('Ваше имя:');
    if (!author) return;
    const text = prompt('Ваш отзыв:');
    if (!text) return;
    currentProduct.reviews.push({ author, text });
    saveProducts();
    renderGrid();
    renderProduct();
    alert('Спасибо за отзыв!');
  });

  /**
   * Рендерит административные кнопки на странице товара
   */
  function renderAdminActions() {
    adminActions.innerHTML = '';
    if (!isAdmin() || !currentProduct) return;
    // Кнопка редактировать цену
    const editPriceBtn = document.createElement('button');
    editPriceBtn.textContent = 'Изменить цену';
    editPriceBtn.addEventListener('click', () => {
      const input = prompt('Новая цена (руб.):', currentProduct.price);
      const val = parseInt(input, 10);
      if (isNaN(val)) {
        alert('Цена должна быть числом');
        return;
      }
      currentProduct.price = val;
      saveProducts();
      renderGrid();
      renderProduct();
    });
    // Кнопка удалить товар
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Удалить товар';
    deleteBtn.addEventListener('click', () => {
      if (!confirm('Удалить этот товар?')) return;
      products = products.filter(p => p.id !== currentProduct.id);
      saveProducts();
      currentProduct = null;
      renderGrid();
      setPage('mainPage');
    });
    // Кнопка загрузить фото
    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = 'Загрузить фото';
    uploadBtn.addEventListener('click', () => {
      imageUploadInput.value = '';
      imageUploadInput.click();
    });
    adminActions.appendChild(editPriceBtn);
    adminActions.appendChild(deleteBtn);
    adminActions.appendChild(uploadBtn);
  }

  // Обработка загрузки изображения
  imageUploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const dataUrl = evt.target.result;
      if (currentProduct) {
        currentProduct.imageData = dataUrl;
        // также добавим как вариант
        currentProduct.variants.push(dataUrl);
        saveProducts();
        renderGrid();
        renderProduct();
      }
    };
    reader.readAsDataURL(file);
  });

  /**
   * Административное добавление нового товара
   */
  function addProduct() {
    const name = prompt('Название товара:');
    if (!name) return;
    const emoji = prompt('Эмодзи товара (или ссылка на фото):');
    if (!emoji) return;
    const priceInput = prompt('Цена (руб.):');
    const priceVal = parseInt(priceInput, 10);
    if (isNaN(priceVal)) {
      alert('Цена должна быть числом');
      return;
    }
    const desc = prompt('Описание товара:') || '';
    const variantsInput = prompt('Варианты (эмодзи или ссылки через запятую)');
    const variants = variantsInput ? variantsInput.split(',').map(s => s.trim()).filter(Boolean) : [emoji];
    const id = name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now();
    const newProduct = { id, name, emoji, price: priceVal, desc, variants, reviews: [] };
    products.push(newProduct);
    saveProducts();
    renderGrid();
    alert('Товар добавлен');
  }

  /**
   * Рендерит панель администратора на главной
   */
  function renderAdminPanelMain() {
    // Удаляем старую кнопку, если есть
    const old = document.getElementById('addProductMain');
    if (old) old.remove();
    if (!isAdmin()) return;
    const btn = document.createElement('button');
    btn.id = 'addProductMain';
    btn.className = 'review-btn';
    btn.textContent = 'Добавить товар';
    btn.addEventListener('click', addProduct);
    // размещаем перед grid
    grid.parentNode.insertBefore(btn, grid.nextSibling);
  }

  // Первичная отрисовка
  renderGrid();
  renderAdminPanelMain();
  setPage('mainPage');
})();