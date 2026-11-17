
/**
 * =====================================================================
 * TÌNH TÍNH TING TING — UI TEXT CONFIG
 * =====================================================================
 * Tập trung toàn bộ câu chữ của thiệp mời tại đây.
 *
 * Phong cách:
 * - Vui nhộn, tinh nghịch, thân mật
 * - Giống lời rủ rê từ một người bạn
 * - Không máy móc, không quá trang trọng
 * - Thông báo lỗi không dùng dấu ? hoặc !
 *
 * Lưu ý:
 * - Không đổi tên các key vì những file khác đang sử dụng.
 * - Thông tin sự kiện mặc định chỉ dùng khi thiếu dữ liệu.
 */

export const UI_TEXT = {

  // -------------------------------------------------------------
  // 1. MÀN HÌNH CHỜ & TẢI TRANG
  // -------------------------------------------------------------
  boot: {
    pageTitle: 'TÌNH TÍNH TING TING — Lời Mời Tương Tác',

    loadingTitle: 'Một chút phép màu đang đến...',

    retryButton: 'Thử lại',
  },

  // -------------------------------------------------------------
  // 2. SÂN KHẤU TƯƠNG TÁC CHỮ KẸO DẺO
  // -------------------------------------------------------------
  stage: {
    // Gợi ý chạm hoặc kéo chữ
    touchHint: 'Ê ê, kéo thử đi',

    // Tên khách được thêm tự động phía sau
    // Ví dụ: HI LINH
    nameGreetingPrefix: 'HI ',

    // Không thêm dấu chấm than sau tên
    nameExclamation: '',

    // Nút mở lời mời chính
    openInviteButton: 'Có gì trong này ta?',

    // Nút ở lại nghịch chữ
    playMoreButton: '↺',

    // Nội dung dự phòng / trợ năng cho nút reload.
    // Muốn chỉ hiện icon cần sửa phần render của nút.
    replayButton: '↺',

    // Nút bỏ qua tương tác để mở thiệp ngay
    viewInviteShortcut: 'Kiên nhẫn kém "zone"',
  },

  // -------------------------------------------------------------
  // 3. THIỆP MỜI POPUP
  // -------------------------------------------------------------
  modal: {
    salutation: 'Có một chiếc hẹn với bạn',

    closeAriaLabel: 'Đóng thiệp',

    fallbackDescription:
      'TÌNH thì khó đoán, TÍNH thì khó chiều, còn TING TING thì phải tới mới biết',
  },

  // -------------------------------------------------------------
  // 4. THÔNG TIN SỰ KIỆN MẶC ĐỊNH
  // -------------------------------------------------------------
  defaultEvent: {
    eventName: 'TÌNH TÍNH TING TING',

    description:
      'TÌNH thì khó đoán, TÍNH thì khó chiều, còn TING TING thì phải tới mới biết',

    date: '20.11.2026 - 21.11.2026',

    startTime: '10:00',
    endTime: '10:00',

    venue: 'Sảnh Trung Tâm',
    address: 'Vincom SkyLake, Hà Nội',

    facebookUrl:
      'https://www.facebook.com/tinhtinhtingting.official',

    instagramUrl:
      'https://www.instagram.com/tinhtinh.tingting',

    websiteUrl:
      'https://tinhtinhtingting.com/',

    tiktokUrl: null as string | null,
    mapsUrl: null as string | null,

    logo: '/assets/brand/logo-white.png',
  },

  // -------------------------------------------------------------
  // 5. THÔNG BÁO LỖI
  // -------------------------------------------------------------
  errors: {
    noLinkCode:
      'Úi, xoá đi là không xem được gì nữa đâu',

    invalidFormat:
      'Hình như chiếc link này hơi sai sai...',

    notFoundOrExpired:
      'Ơ kìa, thiệp đâu mất tiêu rồi',

    timeout:
      'Mạng đang hơi dỗi. Thử lại một xíu nha',

    viewportUnavailable:
      'Màn hình đang giở trò. Thử lại nha',

    genericLoadFailed:
      'Úi, thiệp đang trốn rồi. Thử lại nha',
  },

  // -------------------------------------------------------------
  // 6. TRANG QUẢN TRỊ ADMIN
  // -------------------------------------------------------------
  // Giữ thông báo admin rõ ràng, dễ hiểu.
  // Không áp dụng giọng văn đùa nghịch cho thao tác quản trị.
  admin: {
    pageTitle:
      'Quản lý Thiệp mời — TÌNH TÍNH TING TING',

    copiedLinkAlert: 'Đã sao chép link',

    savedEventAlert:
      'Đã lưu thông tin sự kiện',

    addedGuestAlert:
      'Đã thêm khách. Link mời đã sẵn sàng',

    nameRequiredAlert:
      'Vui lòng nhập tên khách',

    deleteConfirm: (name: string) =>
      `Xóa khách “${name}”? Link đã gửi sẽ không còn hoạt động.`,

    importDisabledAlert:
      'Chức năng nhập hàng loạt đang tạm tắt để tránh ghi đè dữ liệu. Bạn vẫn có thể xuất JSON để sao lưu.',
  },

  // -------------------------------------------------------------
  // 7. TROLL CODER (KHI LINK THIẾU ID HOẶC BẤM THỬ LẠI)
  // -------------------------------------------------------------
  troll: {
    // Các trạng thái chữ trên nút "Thử lại" khi bấm dò ID
    scanningText: 'Đang dò ID...',
    bypassingText: '⚡ Đang bypass bảo mật (67%)...',
    exploitFoundText: 'Ố ồ thấy lỗ hổng! Đang vô...',
    retryAgainButton: 'Thử lại lần nữa xem?',

    // Nội dung trong Popup video troll
    modalTitle: 'Hêh đùa chút thui',
    modalSubtitle: 'thật sự là không có gì đâu.',
    closeButton: 'Quay lại',

    // Cảnh báo trong DevTools Console (F12)
    consoleAlertTag: '[SECURITY ALERT]',
    consoleAlertMessage:
      'Phát hiện anh em đang nghịch ngợm. Nhắn cái gửi cả source code luôn này',
  },

  // -------------------------------------------------------------
  // 8. BẢO MẬT & TRỪNG PHẠT BRUTE-FORCE ADMIN (/hang-mu)
  // -------------------------------------------------------------
  adminSecurity: {
    loggingIn: 'Đang đăng nhập...',
    invalidCredentials: (remaining: number) =>
      `Thông tin đăng nhập không chính xác! (Còn ${remaining} lần thử)`,
    lockout60s: 'Nhập sai 3 lần! Tạm "mở" 60 giây.',
    lockout5m: 'Nhập sai 4 lần! Tạm "mở" 5 phút.',
    lockoutRemaining: (seconds: number) =>
      `Thôi khỏi. Đợi thêm ${seconds} giây trước khi thử lại.`,
    unauthorized: 'Tài khoản chưa được cấp quyền Admin.',
  },

  // -------------------------------------------------------------
  // 9. BẪY HONEYPOT (/admin)
  // -------------------------------------------------------------
  adminHoneypot: {
    title: 'Em xinn anh',
    subtitle: 'em đùa em newbie, dập đầu van xin đó',
    backHomeButton: 'Tha',
    consoleVanXin:
      '[VAN XIN] Thui em đùa em newbie, dập đầu van xin anh em đừng nghịch nữa!',
  },
};


/**
 * =====================================================================
 * ÁP DỤNG CÂU CHỮ VÀO GIAO DIỆN
 * =====================================================================
 *
 * Cập nhật text tĩnh đã có trong index.html.
 * Không thay đổi cấu trúc DOM hay logic thiệp mời.
 */

export function applyUiText(): void {

  // 1. Tiêu đề trình duyệt
  if (UI_TEXT.boot.pageTitle) {
    document.title = UI_TEXT.boot.pageTitle;
  }

  // 2. Boot screen
  const bootTitle =
    document.querySelector<HTMLElement>(
      '#bootScreen .boot-title'
    );

  if (bootTitle) {
    bootTitle.textContent = UI_TEXT.boot.loadingTitle;
  }

  const bootRetry =
    document.getElementById('bootRetry');

  if (bootRetry) {
    bootRetry.textContent = UI_TEXT.boot.retryButton;
  }

  // 3. Sân khấu tương tác
  const touchHint =
    document.querySelector<HTMLElement>(
      '#touchHint span'
    );

  if (touchHint) {
    touchHint.textContent = UI_TEXT.stage.touchHint;
  }

  const btnOpenInviteText =
    document.querySelector<HTMLElement>(
      '#btnOpenInvite .btn-text'
    );

  if (btnOpenInviteText) {
    btnOpenInviteText.textContent =
      UI_TEXT.stage.openInviteButton;
  }

  const btnPlayMoreSpan =
    document.querySelector<HTMLElement>(
      '#btnPlayMore span'
    );

  if (btnPlayMoreSpan) {
    btnPlayMoreSpan.textContent =
      UI_TEXT.stage.playMoreButton;
  }

  // Replay:
  // Giữ nội dung text hiện tại.
  // Icon-only cần xử lý riêng ở component / HTML.
  const btnReplaySpan =
    document.querySelector<HTMLElement>(
      '#btnReplay span'
    );

  if (btnReplaySpan) {
    btnReplaySpan.textContent =
      UI_TEXT.stage.replayButton;
  }

  const btnShortcutSpan =
    document.querySelector<HTMLElement>(
      '#btnShortcut span'
    );

  if (btnShortcutSpan) {
    btnShortcutSpan.textContent =
      UI_TEXT.stage.viewInviteShortcut;
  }

  // 4. Modal lời mời
  const salutation =
    document.querySelector<HTMLElement>(
      '.card-salutation'
    );

  if (salutation) {
    salutation.textContent =
      UI_TEXT.modal.salutation;
  }

  const modalCloseBtn =
    document.getElementById('modalCloseBtn');

  if (modalCloseBtn) {
    modalCloseBtn.setAttribute(
      'aria-label',
      UI_TEXT.modal.closeAriaLabel
    );
  }

  // 5. Troll popup
  const trollTitle =
    document.querySelector<HTMLElement>(
      '#trollModal .troll-title'
    );
  if (trollTitle) {
    trollTitle.textContent = UI_TEXT.troll.modalTitle;
  }

  const trollSubtitle =
    document.querySelector<HTMLElement>(
      '#trollModal .troll-subtitle'
    );
  if (trollSubtitle) {
    trollSubtitle.textContent = UI_TEXT.troll.modalSubtitle;
  }

  const trollCloseBtn =
    document.getElementById('trollCloseBtn');
  if (trollCloseBtn) {
    trollCloseBtn.textContent = UI_TEXT.troll.closeButton;
  }
}
