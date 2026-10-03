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
export const privacyPolicyUpdatedAt = "2026-10-03";

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
    heading: {
      ja: "アクセス解析ツールについて",
      en: "Analytics",
    },
    paragraphs: [
      {
        ja: "当サイトでは、サイトの利用状況を把握し改善に役立てるため、Cloudflare, Inc. が提供するアクセス解析サービス「Cloudflare Web Analytics」を利用しています。",
        en: "To understand how this site is used and to improve it, we use Cloudflare Web Analytics, an analytics service provided by Cloudflare, Inc.",
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
        ja: "当サイトでは、第三者配信の広告サービス「Google AdSense」を利用しています。Google などの第三者配信事業者は、Cookie を使用して、利用者が当サイトや他のウェブサイトに過去にアクセスした際の情報に基づいて広告を配信します。",
        en: "This site uses Google AdSense, a third-party advertising service. Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website and other websites.",
      },
      {
        ja: "Google が広告 Cookie を使用することにより、Google やそのパートナーは、当サイトや他のサイトへのアクセス情報に基づいて利用者に適切な広告を表示できます。これらの情報には、氏名・住所・メールアドレス・電話番号など、個人を特定する情報は含まれません。",
        en: "Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the Internet. This information does not include personally identifiable information such as your name, address, email address, or phone number.",
      },
      {
        ja: "利用者は、Google の広告設定でパーソナライズ広告を無効にできます。また、aboutads.info にアクセスすることで、パーソナライズ広告に使用される第三者配信事業者の Cookie を無効にできます。",
        en: "You may opt out of personalized advertising by visiting Google's Ads Settings. You can also opt out of a third-party vendor's use of cookies for personalized advertising by visiting aboutads.info.",
      },
      {
        ja: "お住まいの地域（欧州経済領域・英国・スイスなど）によっては、Cookie の使用やデータの利用について同意を求めるメッセージが表示される場合があります。同意の内容は、いつでも変更できます。",
        en: "Depending on where you live (for example, the European Economic Area, the United Kingdom, or Switzerland), you may be asked for consent to the use of cookies and data. You can change your choices at any time.",
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
        ja: "当サイトでは、ダークモードなどの表示設定を記憶するため、ブラウザのローカルストレージを使用することがあります。これらの情報は利用者のブラウザ内にのみ保存され、当サイトのサーバーへ送信されることはありません。",
        en: "We may use your browser's local storage to remember display preferences such as dark mode. This information is stored only in your browser and is never sent to our servers.",
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
        ja: "当サイトのツールや掲載情報の正確性・安全性には十分注意していますが、その内容を保証するものではありません。当サイトの利用によって生じたいかなる損害についても、当サイトは責任を負いかねます。また、当サイトからリンクやバナーなどで移動した外部サイトで提供される情報・サービスについても、当サイトは責任を負いません。",
        en: "While we make every effort to ensure the accuracy and safety of our tools and content, we make no guarantees. We are not liable for any damages arising from the use of this site, nor for information or services provided on external sites reached via links or banners from this site.",
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
        ja: "本プライバシーポリシーに関するお問い合わせは、当サイトの GitHub リポジトリの Issues からご連絡ください。",
        en: "If you have any questions about this Privacy Policy, please contact us by opening an issue on our GitHub repository.",
      },
    ],
  },
];
