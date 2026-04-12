/**
 * 3D Game Art Portfolio - Main JS
 */

document.addEventListener('DOMContentLoaded', () => {
  // ================= Navigation Toggle =================
  const navToggle = document.querySelector('.nav-toggle');
  const navList = document.querySelector('.nav ul');

  if (navToggle && navList) {
    navToggle.addEventListener('click', () => {
      navList.classList.toggle('is-open');
    });
  }

  // ================= Works Filter & Sort =================
  const filtersContainer = document.getElementById('workFilters');
  const sortSelect = document.getElementById('workSort');
  const workGrid = document.getElementById('workGrid');

  if (workGrid) {
    const cards = Array.from(workGrid.querySelectorAll('.card'));

    // Filter Logic
    if (filtersContainer) {
      const chips = filtersContainer.querySelectorAll('.chip');
      
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          // Update active class
          chips.forEach(c => c.classList.remove('is-active'));
          chip.classList.add('is-active');

          // Filter cards
          const filterValue = chip.getAttribute('data-filter');

          cards.forEach(card => {
            if (filterValue === 'all') {
              card.classList.remove('hidden');
            } else {
              const cardCats = card.getAttribute('data-cat').split(' ');
              if (cardCats.includes(filterValue)) {
                card.classList.remove('hidden');
              } else {
                card.classList.add('hidden');
              }
            }
          });
        });
      });
    }

    // Sort Logic
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        const sortType = sortSelect.value;

        const parseYearMonth = (value) => { 
          if (!value) return 0;
          const [year, month = '0'] = value.split('.'); 
          return parseInt(year, 10) * 100 + parseInt(month, 10); 
        }; 

        cards.sort((a, b) => {
          const yearA = parseYearMonth(a.dataset.year);
          const yearB = parseYearMonth(b.dataset.year);

          if (sortType === 'newest') {
            return yearB - yearA; // 最新作品
          } else {
            return yearA - yearB; // 最早作品
          }
        });

        cards.forEach(card => workGrid.appendChild(card));
      });
    }
  }

  // ================= Project Detail Logic =================
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id');

  // Dummy project data (Replace with actual data or fetch from JSON)
  const projectsData = {
    'dragon-sculpt': {
      title: '龙｜雕刻练习',
      category: '雕刻类资产',
      year: '2026.3',
      desc: '基于东方传统龙图腾的二次创作。强调鳞片的节奏、面部神态的威严感以及躯干的体块扭转。模型完全使用 ZBrush 雕刻，通过精细的 Alpha 与手工雕刻结合，呈现出极高的材质表现潜力。',
      role: ['高模雕刻', '造型设计', '白模渲染'],
      tools: ['ZBrush', 'Maya', 'Marmoset Toolbag'],
      images: [
        'artwork_picture/dragon_show1.png',
        'artwork_picture/dragon_show2.png',
      ],
    },
    'demon-blade': {
      title: '永劫无间｜谪星狼主｜武器建模',
      category: '武器建模',
      year: '2025.12',
      desc: '一把充满压迫感与侵蚀气质的武器建模练习，强调生物感与金属结构的融合，以及暗黑氛围下的材质层次表现。',
      role: ['高低模制作', '材质贴图', '最终渲染'],
      tools: ['Maya', 'ZBrush', 'Substance Painter', 'Photoshop'],
      images: [
        'artwork_picture/sword_show1.png',
        'artwork_picture/sword_show2.png'
      ],
      viewer: 'artwork_picture/MVIEW/sword3D/sword_show3_3D.html'
    },
    'mechanism-relic': {
      title: '永劫无间｜莲心剑雨｜武器建模',
      category: '武器建模',
      year: '2025.8',
      desc: '结合了莲花元素与机关构造的东方奇幻法器。金属质感的层次分明，暗金与陈旧青铜的结合展现出厚重的历史感与神秘感。',
      role: ['概念细化', '硬表面建模', '材质表达'],
      tools: ['Maya', 'Substance Painter', 'Marmoset Toolbag'],
      images: [
        'artwork_picture/biggun_show1.png',
        'artwork_picture/biggun_show2.png',
      ],
      viewer: 'assets/viewer/yourscene1.html'
    },
    'snake-staff': {
      title: '蛇杖｜武器建模',
      category: '武器建模',
      year: '2025.4',
      desc: '以黑神话风格为灵感的蛇形法杖。顶部的蛇雕刻追求写实与奇幻的平衡，杖身的岩石/树皮肌理与金属箍形成强烈的视觉对比。',
      role: ['高模雕刻', '低模拓扑', 'PBR 材质'],
      tools: ['ZBrush', 'Maya', 'Substance Painter'],
      images: [
        'artwork_picture/snake_show1.png',
        'artwork_picture/snake_show2.png',
      ],
      viewer: 'artwork_picture/MVIEW/snake_3Dshow/snake_3D.html'
    },
    'altar-prop': {
      title: '供台｜场景资产',
      category: '场景设计',
      year: '2025.2',
      desc: '一个带有浓厚东方民俗色彩的祭祀场景道具。注重木纹的岁月侵蚀感、漆面剥落以及场景物件的合理分布。',
      role: ['场景搭建', '资产制作', '灯光渲染'],
      tools: ['Maya', 'ZBrush', 'Substance Painter', 'UE5'],
      images: [
        'artwork_picture/table_show1.png',
      ],
      viewer: 'artwork_picture/MVIEW/table_3Dshow/table_3D.html'  
    },
    'retro-clock': {
      title: '复古座钟｜场景道具',
      category: '单体练习',
      year: '2025.10',
      desc: '展示硬表面建模与写实材质能力的复古物件。精细再现了表盘细节、金属氧化以及玻璃的反光质感。',
      role: ['硬表面建模', '材质贴图'],
      tools: ['Maya', 'Substance Painter', 'Marmoset Toolbag'],
      images: [
        'artwork_picture/clock_show1.png',
        'artwork_picture/clock_show2.png',
      ],
      viewer: 'artwork_picture/MVIEW/table_3Dshow/clock_3D.html'
    }
  };

  const projectTitle = document.getElementById('projectTitle');
  
  if (projectTitle && projectId && projectsData[projectId]) {
    const data = projectsData[projectId];

    // Populate Info
    document.getElementById('projectTitleCrumb').textContent = data.title;
    projectTitle.textContent = data.title;
    document.getElementById('projectSub').textContent = `${data.category} · ${data.year}`;
    document.getElementById('projectDesc').textContent = data.desc;
    document.getElementById('projectTime').textContent = data.year;

    const roleList = document.getElementById('projectRole');
    roleList.innerHTML = data.role.map(r => `<li>${r}</li>`).join('');

    const toolsList = document.getElementById('projectTools');
    toolsList.innerHTML = data.tools.map(t => `<li>${t}</li>`).join('');

    // Populate Carousel
    const track = document.getElementById('carouselTrack');
    const dotsContainer = document.getElementById('carouselDots');
    
    if (track) {
      const mediaItems = [...data.images]; 
      if (data.viewer) { 
        mediaItems.push({ type: 'viewer', src: data.viewer }); 
      }

      if (mediaItems.length > 0) {
        track.innerHTML = '';
        
        mediaItems.forEach(item => { 
          const slide = document.createElement('div'); 
          slide.className = 'carousel-item'; 
        
          if (typeof item === 'string') { 
            slide.innerHTML = `<img src="${item}" alt="${data.title} 展示图" loading="lazy">`; 
          } else if (item.type === 'viewer') { 
            slide.classList.add('is-viewer'); 
            slide.innerHTML = ` 
              <iframe 
                src="${item.src}" 
                title="${data.title} 3D Viewer" 
                loading="lazy" 
                allowfullscreen> 
              </iframe> 
            `; 
          } 
        
          track.appendChild(slide); 
        });

        if (mediaItems.length > 1) {
          dotsContainer.innerHTML = mediaItems.map((_, i) => `
            <div class="dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></div>
          `).join('');
        } else {
          document.querySelector('.carousel-controls').style.display = 'none';
        }

        // Carousel Logic
        let currentIdx = 0;
        const total = mediaItems.length;
        
        const updateCarousel = () => {
          track.style.transform = `translateX(-${currentIdx * 100}%)`;
          if (total > 1) {
            document.querySelectorAll('.dot').forEach((d, i) => {
              d.classList.toggle('active', i === currentIdx);
            });
          }
        };

        document.getElementById('btnPrev')?.addEventListener('click', () => {
          currentIdx = (currentIdx - 1 + total) % total;
          updateCarousel();
        });

        document.getElementById('btnNext')?.addEventListener('click', () => {
          currentIdx = (currentIdx + 1) % total;
          updateCarousel();
        });

        dotsContainer?.addEventListener('click', (e) => {
          if (e.target.classList.contains('dot')) {
            currentIdx = parseInt(e.target.getAttribute('data-idx'));
            updateCarousel();
          }
        });
      } else {
        document.querySelector('.project-media').style.display = 'none';
      }
    }

    // Populate Gallery
    const gallery = document.getElementById('projectGallery');
    if (gallery && data.gallery && data.gallery.length > 0) {
      gallery.innerHTML = data.gallery.map(img => `
        <img src="${img}" alt="${data.title} 过程/细节图" loading="lazy">
      `).join('');
    } else if (gallery) {
      gallery.style.display = 'none';
    }

  } else if (projectTitle) {
    // Project not found
    projectTitle.textContent = '项目未找到';
    document.getElementById('projectSub').textContent = '请返回列表重新选择';
    document.querySelector('.project-media').style.display = 'none';
    document.querySelector('.project-info').style.display = 'none';
  }
});

// Initialize Sorting on Load
window.addEventListener('DOMContentLoaded', () => { 
  const sortSelect = document.getElementById('workSort');
  if (sortSelect) sortSelect.dispatchEvent(new Event('change')); 
});
