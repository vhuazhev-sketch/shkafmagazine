// Скрипт магазина с поиском, сортировкой и работой через Firebase Firestore.
// Этот модуль загружается как ES-модуль (type="module"), поэтому мы можем
// использовать современные импорты.  Данные о товарах и отзывах хранятся
// в Firestore, чтобы все пользователи видели одинаковую информацию.

import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, query, where, onSnapshot, increment } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
// Импортируем функции аутентификации.  Эти функции позволяют
// авторизоваться администратору через Firebase Auth и выходить из
// учётной записи.  onAuthStateChanged будет отслеживать текущий
// статус пользователя и автоматически обновлять интерфейс.
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
// Мы не используем Firebase Storage в этом варианте.  Вместо этого
// фотографии загружаются через сервис Cloudinary.  Если тебе всё же
// потребуется Firebase Storage, импорт оставлен здесь закомментированным.
// import { ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-storage.js';

// --- Cloudinary настройки ---
// Замените эти значения на своё имя облака и unsigned preset,
// созданные в панели управления Cloudinary.  Без них загрузка изображений
// работать не будет.  Подробнее: https://cloudinary.com/documentation/upload_images#uploading_with_a_direct_unsigned_method
// Cloudinary credentials provided by the user
const CLOUD_NAME = 'dgxkowrhk';
const UPLOAD_PRESET = 'shkaf-shop';

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
  reviewsPage: document.getElementById('reviewsPage'),
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

  // Список товаров, загружаемых из Firestore.  products будет
  // обновляться при изменениях в базе через подписку.
  let products = [];

  /**
   * Подписывается на изменения коллекции products в Firestore и
   * обновляет локальный массив products.  При любом изменении
   * автоматически вызывается перерисовка каталога.
   */
  function subscribeProducts() {
    const colRef = collection(window.db, 'products');
    onSnapshot(colRef, snapshot => {
      products = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Добавляем идентификатор документа и пустой массив отзывов
        products.push({
          id: docSnap.id,
          name: data.name,
          emoji: data.emoji || '',
          price: data.price,
          desc: data.desc || '',
          variants: data.variants || [],
          imageData: data.imageUrl || null,
          reviewCount: data.reviewCount || 0,
          category: data.category || 'Другие',
          sizes: data.sizes || [],
          // массив отзывов будет заполняться при открытии товара
          reviews: []
        });
      });
      renderGrid();
      updateCategoryFilter();
    });
  }

  // Хранилище админа
  function isAdmin() { return localStorage.getItem('isAdmin') === 'true'; }
  function setAdmin(flag) { localStorage.setItem('isAdmin', flag ? 'true' : 'false'); }

  // DOM элементы
  const grid = document.getElementById('productsGrid');
  const categoryFilter = document.getElementById('categoryFilter');
  const cartItemsEl = document.getElementById('cartItems');
  const checkoutBtnEl = document.getElementById('checkoutBtn');
  const addToCartBtn = document.getElementById('addToCartBtn');
  const sizeSelect = document.getElementById('sizeSelect');
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
  // Кнопка администратора на странице поддержки.  Используем новую круглую
  // кнопку с эмодзи ключа.  При клике будет происходить вход или
  // выход администратора через Firebase Auth.  Ссылка на элемент
  // сохраняется здесь для дальнейшего использования.
  const adminAuthBtn = document.getElementById('adminAuthBtn');

  // E‑mail администратора.  Этот адрес будет проверяться при входе через
  // Firebase Authentication.  Измените значение на адрес, созданный в
  // разделе Authentication Firebase, чтобы определить, кто является
  // администратором.  Пользователи с другим e‑mail не получат права
  // администрирования.
  const ADMIN_EMAIL = 'h.vladimirs@yandex.ru';
  const allReviewsContainer = document.getElementById('allReviewsContainer');
  const buyBtnEl = document.getElementById('buyBtn');
  // Состояние корзины и категории
  let selectedCategory = 'all';
  let cart = [];

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

  // Кнопка купить на странице товара
  buyBtnEl.addEventListener('click', () => {
    setPage('supportPage');
  });

  backBtn.addEventListener('click', () => {
    currentProduct = null;
    setPage('mainPage');
  });

  // Авторизация администратора.  При нажатии на круглую кнопку с
  // эмодзи 🔑 проверяем, залогинен ли пользователь через Firebase
  // Authentication.  Если уже есть текущий пользователь, выполняем
  // выход.  Иначе запрашиваем адрес e‑mail и пароль и пробуем
  // авторизовать его.  В случае успешного входа устанавливаем
  // флаг администратора и обновляем интерфейс.  Предусмотрена
  // проверка электронной почты: админом считается только
  // пользователь с указанным e‑mail.
  adminAuthBtn.addEventListener('click', async () => {
    const currentUser = window.auth.currentUser;
    if (currentUser) {
      // Пользователь уже вошёл – выполним выход
      try {
        await signOut(window.auth);
        setAdmin(false);
        alert('Вы вышли из режима администратора');
        renderGrid();
        renderAdminPanelMain();
      } catch (err) {
        console.error(err);
        alert('Ошибка при выходе: ' + err.message);
      }
      return;
    }
    const email = prompt('Email администратора:');
    if (!email) return;
    const password = prompt('Пароль:');
    if (!password) return;
    try {
      const userCred = await signInWithEmailAndPassword(window.auth, email, password);
      const user = userCred.user;
      if (user && user.email === ADMIN_EMAIL) {
        setAdmin(true);
        alert('Администраторский режим активирован');
      } else {
        // Успешно вошли, но это не администратор
        setAdmin(false);
        alert('Вход выполнен, но этот пользователь не является администратором');
      }
      renderGrid();
      renderAdminPanelMain();
    } catch (err) {
      console.error(err);
      alert('Ошибка входа: ' + err.message);
    }
  });

  /**
   * Рендерит список товаров, учитывая поиск и сортировку
   */
  function renderGrid() {
    grid.innerHTML = '';
    let filtered = products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery);
      const matchesCat = (selectedCategory === 'all' || p.category === selectedCategory);
      return matchesSearch && matchesCat;
    });
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
        <div class="sub">отзывы: ${p.reviewCount || 0} • ${p.price}₽</div>
      `;
      card.addEventListener('click', () => {
        openProduct(p.id);
      });
      grid.appendChild(card);
    });
    // обновлять общий список отзывов будем отдельно
  }

  /**
   * Открывает страницу товара
   * @param {string} id 
   */
  function openProduct(id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    currentProduct = p;
    // Загружаем отзывы из Firestore перед отображением
    loadProductReviews(p.id).then(() => {
      renderProduct();
    });
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
    // Размеры: если указаны
    if (p.sizes && p.sizes.length > 0) {
      sizeSelect.style.display = '';
      sizeSelect.innerHTML = '';
      p.sizes.forEach(sz => {
        const opt = document.createElement('option');
        opt.value = sz;
        opt.textContent = sz;
        sizeSelect.appendChild(opt);
      });
    } else {
      sizeSelect.style.display = 'none';
      sizeSelect.innerHTML = '';
    }
    // Название, цена, отзывы, описание
    productNameEl.textContent = p.name;
    productPriceEl.textContent = `${p.price}₽`;
    productReviewCount.textContent = `Отзывы: ${p.reviewCount || 0}`;
    productDescEl.textContent = p.desc;
    // Отзывы
    renderProductReviews();
    // Общий список отзывов
    renderAllReviews();
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

  /**
   * Загружает отзывы текущего товара из Firestore и сохраняет их
   * в currentProduct.reviews.  Используется при открытии товара
   * и после добавления нового отзыва.
   * @param {string} productId
   */
  async function loadProductReviews(productId) {
    if (!productId) return;
    const q = query(collection(window.db, 'reviews'), where('productId', '==', productId));
    const snapshot = await getDocs(q);
    if (!currentProduct) return;
    currentProduct.reviews = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      currentProduct.reviews.push({ author: data.userName, text: data.text });
    });
  }

  /**
   * Добавляет отзыв в коллекцию reviews и увеличивает счётчик
   * отзывов в документе товара.  После успешного выполнения
   * обновляет локальный reviewCount.
   * @param {Object} product
   * @param {string} author
   * @param {string} text
   */
  async function addReviewToFirestore(product, author, text) {
    // Добавляем отзыв
    await addDoc(collection(window.db, 'reviews'), {
      productId: product.id,
      productName: product.name,
      productIcon: product.imageData ? product.imageData : product.emoji,
      userName: author,
      text: text,
      createdAt: Date.now(),
    });
    // Увеличиваем счётчик отзывов у товара
    const prodRef = doc(window.db, 'products', product.id);
    await updateDoc(prodRef, { reviewCount: increment(1) });
    // Локально обновляем счётчик
    product.reviewCount = (product.reviewCount || 0) + 1;
  }

  // Кнопка оставить отзыв
  productReviewBtn.addEventListener('click', async () => {
    if (!currentProduct) return;
    const author = prompt('Ваше имя:');
    if (!author) return;
    const text = prompt('Ваш отзыв:');
    if (!text) return;
    try {
      await addReviewToFirestore(currentProduct, author, text);
      alert('Спасибо за отзыв!');
      // Обновляем интерфейс: загрузим отзывы заново и обновим список товаров
      await loadProductReviews(currentProduct.id);
      renderGrid();
      renderProduct();
      renderAllReviews();
    } catch (err) {
      console.error(err);
      alert('Ошибка при добавлении отзыва');
    }
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
    editPriceBtn.addEventListener('click', async () => {
      const input = prompt('Новая цена (руб.):', currentProduct.price);
      const val = parseInt(input, 10);
      if (isNaN(val)) {
        alert('Цена должна быть числом');
        return;
      }
      try {
        // Обновляем цену в Firestore
        const prodRef = doc(window.db, 'products', currentProduct.id);
        await updateDoc(prodRef, { price: val });
        // Локально обновляем цену
        currentProduct.price = val;
        // Обновляем цену в корзине для этого товара
        cart.forEach(item => {
          if (item.id === currentProduct.id) {
            item.price = val;
          }
        });
        saveCart();
        renderCart();
        renderGrid();
        renderProduct();
      } catch (err) {
        console.error(err);
        alert('Ошибка при изменении цены');
      }
    });
    // Кнопка удалить товар
    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Удалить товар';
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('Удалить этот товар?')) return;
      try {
        // Удаляем документ товара из Firestore
        const prodId = currentProduct.id;
        await deleteDoc(doc(window.db, 'products', prodId));
        // Удаляем товар из корзины
        cart = cart.filter(item => item.id !== prodId);
        saveCart();
        renderCart();
        currentProduct = null;
        // После удаления subscribeProducts обновит список товаров
        setPage('mainPage');
      } catch (err) {
        console.error(err);
        alert('Ошибка при удалении товара');
      }
    });
    // Кнопка загрузить фото
    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = 'Загрузить фото';
    uploadBtn.addEventListener('click', () => {
      imageUploadInput.value = '';
      imageUploadInput.click();
    });

    // Кнопка удалить фото
    const deletePhotoBtn = document.createElement('button');
    deletePhotoBtn.textContent = 'Удалить фото';
    deletePhotoBtn.addEventListener('click', async () => {
      if (!currentProduct.imageData) {
        alert('Для этого товара нет загруженного изображения');
        return;
      }
      try {
        // Удаляем изображение из данных: очищаем локальную переменную
        // и обновляем документ Firestore.  Мы не удаляем файл из Storage,
        // чтобы не тратить лишний трафик, но можно реализовать при желании.
        const newVariants = currentProduct.variants.filter(v => {
          // оставляем только эмодзи и строки, которые не похожи на URL-картинки
          return !(v.startsWith('http') || v.startsWith('data:'));
        });
        // Если все варианты были изображениями, оставим эмодзи
        if (newVariants.length === 0) {
          newVariants.push(currentProduct.emoji || '❓');
        }
        const prodRef = doc(window.db, 'products', currentProduct.id);
        await updateDoc(prodRef, { imageUrl: null, variants: newVariants });
        delete currentProduct.imageData;
        currentProduct.variants = newVariants;
        renderGrid();
        renderProduct();
        alert('Фото удалено');
      } catch (err) {
        console.error(err);
        alert('Ошибка при удалении фото');
      }
    });
    adminActions.appendChild(editPriceBtn);
    adminActions.appendChild(deleteBtn);
    adminActions.appendChild(uploadBtn);
    adminActions.appendChild(deletePhotoBtn);
  }

  /**
   * Рендерит общий список отзывов на странице отзывов
   */
  async function renderAllReviews() {
    if (!allReviewsContainer) return;
    allReviewsContainer.innerHTML = '';
    try {
      const snapshot = await getDocs(collection(window.db, 'reviews'));
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const card = document.createElement('div');
        card.className = 'review-card';
        // определяем иконку товара: если это URL изображения, показываем картинкой
        let iconHTML;
        const icon = data.productIcon;
        if (icon && (icon.startsWith('http') || icon.startsWith('data:'))) {
          iconHTML = `<img src="${icon}" style="width:20px;height:20px;border-radius:4px;margin-right:6px;vertical-align:middle;">`;
        } else {
          iconHTML = `<span style="margin-right:6px;">${icon || ''}</span>`;
        }
        card.innerHTML = `
          <div><strong>${iconHTML}${data.productName}</strong> — <em>${data.userName}</em></div>
          <div>${data.text}</div>
        `;
        allReviewsContainer.appendChild(card);
      });
    } catch (err) {
      console.error('Ошибка загрузки отзывов', err);
    }
  }

  // Обработка загрузки изображения: отправляет файл на Cloudinary
  imageUploadInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file || !currentProduct) return;
    if (!CLOUD_NAME || !UPLOAD_PRESET || CLOUD_NAME === 'your_cloud_name') {
      alert('Нужно настроить CLOUD_NAME и UPLOAD_PRESET для загрузки изображений.');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/upload`;
      const resp = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });
      const data = await resp.json();
      if (!data.secure_url) {
        throw new Error('Cloudinary upload failed');
      }
      const url = data.secure_url;
      // Обновляем данные в Firestore: основное изображение и варианты
      const prodRef = doc(window.db, 'products', currentProduct.id);
      const newVariants = currentProduct.variants ? [...currentProduct.variants, url] : [url];
      await updateDoc(prodRef, { imageUrl: url, variants: newVariants });
      currentProduct.imageData = url;
      currentProduct.variants = newVariants;
      renderGrid();
      renderProduct();
      alert('Изображение загружено');
    } catch (err) {
      console.error(err);
      alert('Ошибка при загрузке изображения');
    }
  });

  /**
   * Административное добавление нового товара
   */
  async function addProduct() {
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
    const category = prompt('Категория товара (например: Футболки, Брюки и т.п.):') || 'Другие';
    const sizesInput = prompt('Размеры (через запятую, например S,M,L). Оставьте пустым, если размеров нет:');
    const sizes = sizesInput ? sizesInput.split(',').map(s => s.trim()).filter(Boolean) : [];
    const variantsInput = prompt('Варианты (эмодзи или ссылки через запятую). Если оставить пустым, используется эмодзи товара:');
    const variants = variantsInput ? variantsInput.split(',').map(s => s.trim()).filter(Boolean) : [emoji];
    try {
      await addDoc(collection(window.db, 'products'), {
        name: name,
        emoji: emoji,
        price: priceVal,
        desc: desc,
        variants: variants,
        imageUrl: null,
        reviewCount: 0,
        category: category,
        sizes: sizes,
      });
      alert('Товар добавлен');
      // subscribeProducts автоматически обновит каталог
    } catch (err) {
      console.error(err);
      alert('Ошибка при добавлении товара');
    }
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

  /* === Корзина и категории === */
  /** Загружает корзину из localStorage */
  function loadCart() {
    try {
      cart = JSON.parse(localStorage.getItem('cart') || '[]');
      if (!Array.isArray(cart)) cart = [];
    } catch (e) {
      cart = [];
    }
  }
  /** Сохраняет корзину в localStorage */
  function saveCart() {
    localStorage.setItem('cart', JSON.stringify(cart));
  }
  /** Добавляет товар в корзину */
  function addToCart(product, size) {
    const item = {
      id: product.id,
      name: product.name,
      price: product.price,
      size: size || '',
      quantity: 1,
    };
    cart.push(item);
    saveCart();
    renderCart();
  }
  /** Удаляет товар из корзины по индексу */
  function removeFromCart(index) {
    cart.splice(index, 1);
    saveCart();
    renderCart();
  }
  /** Отрисовывает корзину на странице */
  function renderCart() {
    if (!cartItemsEl) return;
    cartItemsEl.innerHTML = '';
    if (cart.length === 0) {
      cartItemsEl.innerHTML = '<p>Корзина пуста</p>';
      return;
    }
    cart.forEach((item, index) => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      const info = document.createElement('div');
      info.className = 'info';
      const sizeStr = item.size ? `Размер: ${item.size}<br>` : '';
      info.innerHTML = `<strong>${item.name}</strong><br>${sizeStr}Цена: ${item.price}₽`;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.textContent = 'Удалить';
      removeBtn.addEventListener('click', () => removeFromCart(index));
      div.appendChild(info);
      div.appendChild(removeBtn);
      cartItemsEl.appendChild(div);
    });
  }
  /** Обновляет выпадающий список категорий */
  function updateCategoryFilter() {
    if (!categoryFilter) return;
    const current = selectedCategory;
    const cats = new Set();
    products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    // Обновляем options
    categoryFilter.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = 'Все категории';
    categoryFilter.appendChild(allOpt);
    cats.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      if (cat === current) opt.selected = true;
      categoryFilter.appendChild(opt);
    });
  }

  // Слушаем изменения аутентификации.  Этот обработчик будет вызываться
  // каждый раз, когда пользователь входит или выходит.  Если текущий
  // пользователь существует и его e‑mail совпадает с адресом
  // администратора, устанавливаем режим администратора; иначе
  // отключаем его.  После переключения обновляем каталог и панель
  // администратора, чтобы интерфейс сразу отражал изменения.
  onAuthStateChanged(window.auth, (user) => {
    if (user && user.email === ADMIN_EMAIL) {
      setAdmin(true);
    } else {
      setAdmin(false);
    }
    renderGrid();
    renderAdminPanelMain();
  });

  // Запускаем подписку на коллекцию товаров.  Это автоматически
  // вызовет renderGrid() при любых изменениях в базе.
  subscribeProducts();
  // Отрисовываем панель администратора и список отзывов.
  renderAdminPanelMain();
  renderAllReviews();
  // Загружаем корзину из localStorage и отображаем её
  loadCart();
  renderCart();
  // Настраиваем фильтр категорий
  updateCategoryFilter();
  if (categoryFilter) {
    categoryFilter.addEventListener('change', e => {
      selectedCategory = e.target.value;
      renderGrid();
    });
  }
  // Добавление в корзину
  if (addToCartBtn) {
    addToCartBtn.addEventListener('click', () => {
      if (!currentProduct) return;
      const size = (sizeSelect && sizeSelect.style.display !== 'none') ? sizeSelect.value : '';
      addToCart(currentProduct, size);
      alert('Товар добавлен в корзину');
      setPage('cartPage');
    });
  }
  // Оформление заказа (в будущем можно интегрировать оплату)
  if (checkoutBtnEl) {
    checkoutBtnEl.addEventListener('click', () => {
      if (cart.length === 0) {
        alert('Корзина пуста');
        return;
      }
      alert('Спасибо! Заказ оформлен. В ближайшее время с вами свяжутся.');
      cart = [];
      saveCart();
      renderCart();
      setPage('mainPage');
    });
  }
  setPage('mainPage');
})();