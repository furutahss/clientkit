import type { LocalizedText } from "@/config/tools";

export type PrivacyPolicyLink = {
  label: LocalizedText;
  href: string;
};

export type PrivacyPolicySection = {
  heading: LocalizedText;
  paragraphs: LocalizedText[];
  links?: PrivacyPolicyLink[];
};

/** 制定日（ISO形式 YYYY-MM-DD） */
export const privacyPolicyEstablishedAt = "2026-10-03";
/** 最終更新日（ISO形式 YYYY-MM-DD）。内容を変更したら更新する。 */
export const privacyPolicyUpdatedAt = "2026-10-20";

/**
 * プライバシーポリシー本文。
 * アクセス解析（Cloudflare Web Analytics）と広告配信（Google AdSense）に関する記載を含む。
 */
export const privacyPolicySections: PrivacyPolicySection[] = [
  {
    heading: {
      ja: "基本方針",
      en: "Overview",
    },
    paragraphs: [
      {
        ja: "ClientKit（以下「当サイト」）は、利用者のプライバシーを尊重し、個人情報の保護に努めます。本プライバシーポリシーでは、当サイトにおける利用者情報の取り扱いについて説明します。",
        en: "ClientKit (\"we\", \"this site\") respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how information is handled on this site.",
      },
    ],
  },
  {
    heading: {
      ja: "ツールに入力したデータの取り扱い",
      en: "Data You Enter Into the Tools",
    },
    paragraphs: [
      {
        ja: "当サイトのツールは、すべての処理を利用者のブラウザ上で行います。ツールに入力したテキストや読み込んだファイル（画像・PDF・ログなど）が当サイトのサーバーへ送信・保存されることはなく、当サイトがその内容を収集することもありません。",
        en: "All of our tools run entirely in your browser. The text you enter and the files you load (images, PDFs, logs, etc.) are never sent to or stored on our servers, and we do not collect their contents.",
      },
    ],
  },
  {
    heading: { ja: "サイト表示と資産の取得", en: "Page delivery and asset downloads" },
    paragraphs: [{
      ja: "ページ表示、OCRの言語データ、背景除去モデル、PDF用フォントなどの取得ではネットワーク通信が発生します。配信サーバーは要求されたURLや接続に必要なIPアドレス等を扱います。入力の解析を端末内で行うことと、ページ・広告の読み込みで通信が発生することは別です。Markdown内の外部画像など、入力に含まれる外部リソースを表示する場合は、その配信先にアクセスします。",
      en: "Network requests load pages and assets such as OCR language data, a background removal model, and PDF fonts. Delivery servers handle requested URLs and connection information such as IP addresses. Local input processing is separate from page and advertising requests. Displaying an external resource included in your input, such as an image in Markdown, contacts that resource’s host.",
    }],
  },
  {
    heading: {
      ja: "アクセス解析ツールについて",
      en: "Analytics",
    },
    paragraphs: [
      {
        ja: "配信基盤のCloudflareでは、ホスティング側でWeb Analyticsが有効な場合、ページ表示の統計が収集されます。リポジトリには専用の解析スクリプトを設置していませんが、配信時に追加される解析にはCloudflareのポリシーが適用されます。",
        en: "Cloudflare, the hosting provider, can collect page-view statistics when Web Analytics is enabled in the hosting configuration. No dedicated analytics script is installed in this repository; analytics injected during delivery are subject to Cloudflare’s policies.",
      },
      {
        ja: "Cloudflare Web Analytics は Cookie やローカルストレージを使用せず、利用者を追跡したり個人を特定したりする情報を収集しません。収集されるのは、閲覧されたページのURL、参照元、ブラウザやOSの種類、アクセス元の国・地域、ページの表示速度などの統計的なデータです。",
        en: "Cloudflare Web Analytics does not use cookies or local storage, and it does not collect information used to track or identify individual visitors. It collects only aggregated data such as the URLs of pages viewed, referrers, browser and operating system types, country or region, and page load performance.",
      },
    ],
    links: [
      {
        label: {
          ja: "Cloudflare プライバシーポリシー",
          en: "Cloudflare Privacy Policy",
        },
        href: "https://www.cloudflare.com/privacypolicy/",
      },
    ],
  },
  {
    heading: {
      ja: "広告の配信について",
      en: "Advertising",
    },
    paragraphs: [
      {
        ja: "当サイトにはGoogle AdSenseの広告コードを設置しています。審査・配信状態や利用者の設定に応じ、Googleなどの第三者配信事業者がCookieを使って、当サイトや他のサイトへの過去のアクセスに基づく広告を配信する場合があります。",
        en: "This site includes Google AdSense code. Depending on review status, ad availability, and your settings, third-party vendors including Google may use cookies to serve ads based on your previous visits to this and other websites.",
      },
      {
        ja: "Google が広告 Cookie を使用することにより、Google やそのパートナーは、当サイトや他のサイトへのアクセス情報に基づいて利用者に適切な広告を表示できます。Cookie等による識別子や閲覧・端末情報の扱いは、Googleのプライバシーポリシーをご確認ください。",
        en: "Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the Internet. Consult Google’s policies for its handling of cookie identifiers, browsing activity, and device information.",
      },
      {
        ja: "利用者は、Google の広告設定でパーソナライズ広告を無効にできます。また、aboutads.info にアクセスすることで、パーソナライズ広告に使用される第三者配信事業者の Cookie を無効にできます。",
        en: "You may opt out of personalized advertising by visiting Google's Ads Settings. You can also opt out of a third-party vendor's use of cookies for personalized advertising by visiting aboutads.info.",
      },
      {
        ja: "お住まいの地域（欧州経済領域・英国・スイスなど）によっては、Cookie の使用やデータの利用について同意を求めるメッセージが表示される場合があります。同意設定の画面が提供される場合は、その画面で選択内容をご確認ください。",
        en: "Depending on where you live (for example, the European Economic Area, the United Kingdom, or Switzerland), you may be asked for consent to the use of cookies and data. Where consent settings are provided, use that interface to review your choices.",
      },
    ],
    links: [
      {
        label: {
          ja: "Google 広告設定",
          en: "Google Ads Settings",
        },
        href: "https://adssettings.google.com/",
      },
      {
        label: {
          ja: "aboutads.info（第三者配信事業者の Cookie の無効化）",
          en: "aboutads.info (opt out of third-party vendor cookies)",
        },
        href: "https://www.aboutads.info/choices/",
      },
      {
        label: {
          ja: "Google のサービスを使用するサイトやアプリから収集した情報の Google による使用",
          en: "How Google uses information from sites or apps that use its services",
        },
        href: "https://policies.google.com/technologies/partner-sites",
      },
      {
        label: {
          ja: "Google 広告に関するポリシー",
          en: "Google Advertising Policies",
        },
        href: "https://policies.google.com/technologies/ads",
      },
    ],
  },
  {
    heading: {
      ja: "Cookie の無効化について",
      en: "Disabling Cookies",
    },
    paragraphs: [
      {
        ja: "利用者は、ブラウザの設定により Cookie を無効にしたり、保存されている Cookie を削除したりできます。Cookie を無効にした場合でも、当サイトのツールは引き続き利用できますが、広告の表示内容が変わる場合があります。設定方法は、お使いのブラウザのヘルプをご確認ください。",
        en: "You can disable cookies or delete stored cookies in your browser settings. The tools on this site will continue to work with cookies disabled, although the ads you see may change. Please refer to your browser's help for instructions.",
      },
    ],
  },
  {
    heading: {
      ja: "ブラウザに保存される情報",
      en: "Information Stored in Your Browser",
    },
    paragraphs: [
      {
        ja: "表示設定、お気に入り・ツールの利用履歴、テキスト正規化の設定にlocalStorageを使います。請求書の入力とMermaid図のソースもブラウザ内に保存されます。Mermaidの共有URLでは図の内容がURLのフラグメントに含まれるため、URLを渡した相手も内容を復元できます。背景除去モデルはCache APIに保存されます。共用端末では各ツールのリセットとブラウザのサイトデータ削除を行ってください。これらの保存内容を当サイトの処理サーバーへ送信することはありません。",
        en: "Local storage remembers display settings, favorites, tool history, and text normalization options. Invoice inputs and Mermaid diagram source are also saved in the browser. A Mermaid sharing URL contains diagram data in its fragment, so recipients can recover that content. The background removal model is stored with the Cache API. On shared devices, reset the relevant tool and clear browser site data. These saved contents are not uploaded to our processing servers.",
      },
    ],
  },
  {
    heading: {
      ja: "免責事項",
      en: "Disclaimer",
    },
    paragraphs: [
      {
        ja: "当サイトのツールや掲載情報の正確性・安全性には十分注意していますが、その内容を保証するものではありません。結果は元データと照合して利用してください。責任の範囲は適用法令に従います。また、当サイトからリンクやバナーなどで移動した外部サイトで提供される情報・サービスについても、当サイトは責任を負いません。",
        en: "While we make every effort to ensure the accuracy and safety of our tools and content, we make no guarantees. Verify results against the original data before use. Liability is subject to applicable law. External sites reached through links or banners have their own terms and policies.",
      },
    ],
  },
  {
    heading: {
      ja: "プライバシーポリシーの変更",
      en: "Changes to This Policy",
    },
    paragraphs: [
      {
        ja: "当サイトは、法令の変更やサービス内容の変更に応じて、本プライバシーポリシーを予告なく改定することがあります。改定後のプライバシーポリシーは、本ページに掲載した時点から効力を生じるものとします。",
        en: "We may revise this Privacy Policy without notice in response to changes in laws or in our services. The revised policy takes effect when it is posted on this page.",
      },
    ],
  },
  {
    heading: {
      ja: "お問い合わせ",
      en: "Contact",
    },
    paragraphs: [
      {
        ja: "運営責任者はTODO_OPERATOR_NAME、非公開の連絡先はTODO_OPERATOR_EMAIL（運営者による記入待ち）です。公開可能な不具合はGitHub Issuesでも受け付けます。問い合わせで提供された情報は回答と調査に使用します。公開の投稿に個人情報や秘密情報を含めないでください。",
        en: "The responsible operator is TODO_OPERATOR_NAME. Private contact: TODO_OPERATOR_EMAIL (awaiting completion by the operator). Public bugs can also be reported on GitHub Issues. Information provided in correspondence is used for replies and investigation. Do not include personal or confidential information in public posts.",
      },
    ],
  },
];
