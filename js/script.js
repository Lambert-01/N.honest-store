(function($) {

  "use strict";

  var initPreloader = function() {
    $(document).ready(function($) {
      var Body = $('body');
      Body.addClass('preloader-site');
    });
    $(window).on('load', function() {
      $('.preloader-wrapper').fadeOut();
      $('body').removeClass('preloader-site');
    });
  };

  // Initialize Chocolat lightbox
  var initChocolat = function() {
    Chocolat(document.querySelectorAll('.image-link'), {
      imageSize: 'contain',
      loop: true,
    });
  };

  // Initialize Swiper sliders
  var initSwiper = function() {
    // Main Banner Slider
    var swiper = new Swiper(".main-swiper", {
      speed: 500,
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },
    });

    // Category Carousel
    var category_swiper = new Swiper(".category-carousel", {
      slidesPerView: 4,
      spaceBetween: 16,
      speed: 500,
      navigation: {
        nextEl: ".category-carousel-next",
        prevEl: ".category-carousel-prev",
      },
      breakpoints: {
        320: { slidesPerView: 1 },
        768: { slidesPerView: 2 },
        992: { slidesPerView: 3 },
        1200: { slidesPerView: 4 },
      },
    });

    // Products Carousel
    $(".products-carousel").each(function() {
      var $el_id = $(this).attr('id');

      var products_swiper = new Swiper("#" + $el_id + " .swiper", {
        slidesPerView: 5,
        spaceBetween: 30,
        speed: 500,
        navigation: {
          nextEl: "#" + $el_id + " .products-carousel-next",
          prevEl: "#" + $el_id + " .products-carousel-prev",
        },
        breakpoints: {
          0: { slidesPerView: 1 },
          768: { slidesPerView: 3 },
          991: { slidesPerView: 4 },
          1500: { slidesPerView: 5 },
        },
      });
    });

    // Product Single Page Slider
    var thumb_slider = new Swiper(".product-thumbnail-slider", {
      slidesPerView: 5,
      spaceBetween: 20,
      direction: "vertical",
      breakpoints: {
        0: { direction: "horizontal" },
        992: { direction: "vertical" },
      },
    });

    var large_slider = new Swiper(".product-large-slider", {
      slidesPerView: 1,
      spaceBetween: 0,
      effect: 'fade',
      thumbs: {
        swiper: thumb_slider,
      },
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },
    });
  };

  // Input Spinner for Quantity
  var initProductQty = function() {
    $('.product-qty').each(function() {
      var $el_product = $(this);
      var quantity = 0;

      $el_product.find('.quantity-right-plus').click(function(e) {
        e.preventDefault();
        quantity = parseInt($el_product.find('#quantity').val());
        $el_product.find('#quantity').val(quantity + 1);
      });

      $el_product.find('.quantity-left-minus').click(function(e) {
        e.preventDefault();
        quantity = parseInt($el_product.find('#quantity').val());
        if (quantity > 0) {
          $el_product.find('#quantity').val(quantity - 1);
        }
      });
    });
  };

  // Initialize Jarallax Parallax
  var initJarallax = function() {
    jarallax(document.querySelectorAll(".jarallax"));

    jarallax(document.querySelectorAll(".jarallax-keep-img"), {
      keepImg: true,
    });
  };

  // Fetch Products Dynamically
  var fetchProducts = async function(category = '') {
    const productGrid = document.getElementById('product-grid');

    try {
      const url = category ? `/api/products?category=${category}` : '/api/products';
      const response = await fetch(url);
      const products = await response.json();

      productGrid.innerHTML = '';

      products.forEach(product => {
        const productCard = `
          <div class="col">
            <div class="product-item">
              <figure>
                <a href="index.html" title="${product.name}">
                  <img src="${product.image}" alt="${product.name}" class="tab-image">
                </a>
              </figure>
              <div class="d-flex flex-column text-center">
                <h3 class="fs-6 fw-normal">${product.name}</h3>
                <div>
                  <span class="rating">
                    ${createRatingStars(product.rating)}
                  </span>
                  <span>(${product.reviews})</span>
                </div>
                <div class="d-flex justify-content-center align-items-center gap-2">
                  <del>$${product.oldPrice}</del>
                  <span class="text-dark fw-semibold">$${product.price}</span>
                  <span class="badge border border-dark-subtle rounded-0 fw-normal px-1 fs-7 lh-1 text-body-tertiary">${product.discount}% OFF</span>
                </div>
                <div class="button-area p-3 pt-0">
                  <div class="row g-1 mt-2">
                    <div class="col-3">
                      <input type="number" name="quantity" class="form-control border-dark-subtle input-number quantity" value="1">
                    </div>
                    <div class="col-7">
                      <a href="#" class="btn btn-primary rounded-1 p-2 fs-7 btn-cart" onclick="addToCart('${product.name}', ${product.price})">
                        <svg width="18" height="18"><use xlink:href="#cart"></use></svg> Add to Cart
                      </a>
                    </div>
                    <div class="col-2">
                      <a href="#" class="btn btn-outline-dark rounded-1 p-2 fs-6">
                        <svg width="18" height="18"><use xlink:href="#heart"></use></svg>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
        productGrid.innerHTML += productCard;
      });
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  // Create Rating Stars
  var createRatingStars = function(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 !== 0;
    const stars = [];

    for (let i = 0; i < fullStars; i++) {
      stars.push('<svg width="18" height="18" class="text-warning"><use xlink:href="#star-full"></use></svg>');
    }

    if (halfStar) {
      stars.push('<svg width="18" height="18" class="text-warning"><use xlink:href="#star-half"></use></svg>');
    }

    for (let i = stars.length; i < 5; i++) {
      stars.push('<svg width="18" height="18" class="text-warning"><use xlink:href="#star-empty"></use></svg>');
    }

    return stars.join('');
  };

  // Add Product to Cart
  window.addToCart = function(name, price) {
    alert(`${name} added to cart for $${price}`);
  };

  // Document Ready
  $(document).ready(function() {
    initPreloader();
    initSwiper();
    initProductQty();
    initJarallax();
    initChocolat();

    // Fetch all products initially
    fetchProducts('');

    // Add click event listeners to category cards
    document.querySelectorAll('.category-carousel .card').forEach(card => {
      card.addEventListener('click', async (e) => {
        const category = e.currentTarget.querySelector('.card-title').innerText.toLowerCase();
        await fetchProducts(category);
      });
    });
  });

})(jQuery);