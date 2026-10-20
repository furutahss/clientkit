import type { LocalizedText } from './tools';

type TrustPage = {
  title: LocalizedText;
  description: LocalizedText;
  sections: { heading: LocalizedText; paragraphs: LocalizedText[] }[];
};

export const trustPages: Record<string, TrustPage> = {
  about: {
    title: { ja: 'ClientKitについて', en: 'About ClientKit' },
    description: { ja: 'ClientKitの目的、ブラウザ内で処理する仕組み、ツールの使い分けと説明の編集方針を紹介します。', en: 'Learn why ClientKit exists, how local processing works, and how its tools and documentation are maintained.' },
    sections: [
      { heading: { ja: '日々の小さな変換・確認作業のために', en: 'A workspace for everyday conversions and checks' }, paragraphs: [
        { ja: 'ClientKitは、文章の比較、JSONやSQLの整形、画像やPDFの処理などを、インストールせずブラウザで行うためのツール集です。開発中の設定の点検や、書類・素材の準備で、別のアプリを立ち上げる手間を減らすことを目的としています。ツールは対象データごとのカテゴリから探せます。', en: 'ClientKit brings together text comparisons, JSON and SQL formatting, image and PDF processing, and other everyday checks in a browser workspace. Its purpose is to reduce the setup needed for a small task while preparing code, documents, or visual assets. Browse the categories to find a tool for your data.' },
      ] },
      { heading: { ja: '入力の処理と通信の区別', en: 'Local processing and network requests' }, paragraphs: [
        { ja: 'ツールに入力した内容の変換や解析は端末上で行います。ページの読み込みやOCR用の言語データ、背景除去のモデル、PDF用のフォントの取得などには通信が必要です。「ブラウザ内で処理」とは、入力を処理サーバーへアップロードしないという意味で、サイト全体が通信しないという意味ではありません。広告などの外部サービスの取り扱いはプライバシーポリシーで説明しています。', en: 'Tool inputs are transformed or analyzed on your device. Network requests are still needed to load pages and assets such as OCR language data, a background removal model, and PDF fonts. Local processing means your input is not uploaded to a processing server; it does not mean the entire site makes no network requests. See the Privacy Policy for external services, including advertising.' },
      ] },
      { heading: { ja: '説明と結果の確認方針', en: 'Documentation and checking results' }, paragraphs: [
        { ja: '各ページには操作手順、入力と出力の例、対応範囲、よくある質問を掲載します。説明はそのツールの実装に合わせて更新し、対応していない機能を案内しない方針です。結果を実際のシステムや書類に利用する前に、小さなサンプルで試し、元データと照合してください。不具合は再現手順と合わせてお問い合わせページから報告できます。', en: 'Each tool page explains its workflow, gives an input and output example, and describes limitations and common questions. Documentation should follow the implemented behavior rather than promise unsupported features. Before using output in a system or document, try a small sample and compare it against the original. Report discrepancies with reproduction steps through the Contact page.' },
      ] },
    ],
  },
  operator: {
    title: { ja: '運営者情報', en: 'Operator information' },
    description: { ja: 'ClientKitの運営責任者、連絡窓口、情報更新と不具合対応の方針を掲載します。', en: 'Operator details, contact information, and the approach to maintaining ClientKit and addressing reported issues.' },
    sections: [
      { heading: { ja: '運営責任者と連絡先', en: 'Responsible operator and contact details' }, paragraphs: [
        { ja: '運営者名: TODO_OPERATOR_NAME', en: 'Operator name: TODO_OPERATOR_NAME' },
        { ja: '連絡用メールアドレス: TODO_OPERATOR_EMAIL', en: 'Contact email address: TODO_OPERATOR_EMAIL' },
        { ja: '所在地・住所の公開表記: TODO_OPERATOR_ADDRESS', en: 'Published location or address: TODO_OPERATOR_ADDRESS' },
        { ja: 'これらの項目は運営者による確認・記入待ちです。記載のプレースホルダーは実際の氏名・連絡先・住所ではありません。', en: 'These fields await confirmation and completion by the operator. The placeholders are not actual names, contact details, or addresses.' },
      ] },
      { heading: { ja: '運営と更新', en: 'Maintenance' }, paragraphs: [
        { ja: 'ClientKitのソースコードと公開の不具合報告窓口はGitHubで公開しています。機能の変更は更新履歴で案内します。入力データの内容を収集して不具合を調べる方式ではないため、ご報告の際は機密情報を含まない最小限の再現例をお知らせください。', en: 'ClientKit provides its source code and a public issue tracker on GitHub. Feature changes are described in the release notes. We do not collect tool inputs to investigate failures, so a report should include a minimal reproduction example that contains no confidential information.' },
      ] },
    ],
  },
  contact: {
    title: { ja: 'お問い合わせ', en: 'Contact ClientKit' },
    description: { ja: 'ClientKitの不具合、掲載情報の訂正、プライバシーに関する問い合わせ方法と報告時の必要事項です。', en: 'How to report a ClientKit bug, request a documentation correction, or raise a privacy question without sharing sensitive inputs.' },
    sections: [
      { heading: { ja: '連絡窓口', en: 'Contact channels' }, paragraphs: [
        { ja: '公開してよい不具合や改善提案は、下記のGitHub Issuesから送れます。GitHubのアカウントが必要です。投稿した内容は公開されるため、入力した実データ、パスワード、トークン、氏名などは載せないでください。', en: 'Use the GitHub issue tracker linked below for bugs and suggestions that can be discussed publicly. A GitHub account is required. Posts are public: do not include real input files, passwords, tokens, names, or other private data.' },
        { ja: '非公開の連絡用メールアドレス: TODO_OPERATOR_EMAIL。運営者がこの項目を確定するまではメール窓口は利用できません。', en: 'Private contact email: TODO_OPERATOR_EMAIL. This email channel is unavailable until the operator supplies the actual address.' },
      ] },
      { heading: { ja: '不具合報告に含める情報', en: 'What to include in a bug report' }, paragraphs: [
        { ja: 'ツール名またはページのURL、ブラウザ名、操作手順、期待した結果と実際の結果をお知らせください。サンプルは個人情報を取り除いた短いものにしてください。ファイル処理では拡張子や選んだ出力設定があると調査に役立ちます。', en: 'Include the tool name or page URL, browser name, steps, expected output, and actual output. Use a short, anonymized sample. For file operations, the extension and output settings help reproduce the problem.' },
      ] },
      { heading: { ja: '問い合わせ情報の取り扱い', en: 'Handling correspondence' }, paragraphs: [
        { ja: 'お問い合わせで任意に提供された情報は、内容の確認と返信、不具合の調査のために使用します。ツール本体が入力を送信しないことと、お問い合わせ時にご自身が送信する情報は別です。返信時期や個別対応を保証するものではありません。', en: 'Information you choose to provide in correspondence is used to assess and answer your request and investigate issues. Sending a report is separate from the tools, which do not upload inputs. A response time or individual resolution is not guaranteed.' },
      ] },
    ],
  },
  terms: {
    title: { ja: '利用規約', en: 'Terms of use' },
    description: { ja: 'ClientKitの利用条件、入力データの権利、出力の確認、禁止行為、サービス変更について説明します。', en: 'Conditions for using ClientKit, responsibility for input rights and output checks, prohibited use, and service changes.' },
    sections: [
      { heading: { ja: '利用条件', en: 'Using the service' }, paragraphs: [
        { ja: '本規約はClientKitのツールと掲載情報の利用に適用します。利用者は各ツールの説明と制限事項を確認し、ご自身の判断で利用してください。アカウント登録は不要です。ネットワーク接続や端末の用意、ダウンロードした結果の管理は利用者が行います。', en: 'These terms apply to ClientKit tools and documentation. Read the relevant tool instructions and limitations and decide whether it suits your task. No account is required. You are responsible for your connection, device, and management of downloaded results.' },
      ] },
      { heading: { ja: '入力データと生成結果', en: 'Inputs and output' }, paragraphs: [
        { ja: '入力する文章・画像・コードなどについて、利用に必要な権利や許可を確保してください。当サイトの利用によって入力データの権利が運営者へ移ることはありません。生成コード、変換結果、計算結果は補助資料であり、利用先の仕様や元データと照合してください。元ファイルを保存し、重要な情報は別の方法でも検証してください。', en: 'Ensure you have the rights or permission needed to process text, images, code, and other inputs. Using this site does not transfer rights in those inputs to the operator. Generated code, conversions, and calculations are aids: check them against your target specifications and original data. Keep original files and independently verify important results.' },
      ] },
      { heading: { ja: '禁止行為', en: 'Prohibited use' }, paragraphs: [
        { ja: '法令や第三者の権利を侵害する行為、サービスの妨害、不正アクセス、脆弱性の悪用を禁止します。不具合やセキュリティ上の問題を見つけた場合は、個人情報や秘密情報を公開せず、お問い合わせ窓口へ連絡してください。', en: 'Do not use the service to violate laws or third-party rights, disrupt availability, gain unauthorized access, or exploit vulnerabilities. If you discover a defect or security issue, contact the operator without publishing personal or confidential information.' },
      ] },
      { heading: { ja: '保証・責任と変更', en: 'Limitations and changes' }, paragraphs: [
        { ja: '結果の正確性、特定目的への適合性、継続提供を保証しません。運営者の責任は適用される法令の範囲で判断され、本規約は法令上認められない責任制限を意図しません。機能や掲載内容、規約を更新する場合があります。変更後の内容は本サイトで確認できます。個人情報の取り扱いはプライバシーポリシーをご確認ください。', en: 'Accuracy, fitness for a particular purpose, and continued availability are not guaranteed. Operator liability is determined under applicable law; these terms do not seek to exclude liability where that is not permitted. Features, documentation, and these terms may change. Updated information is published on this site. The Privacy Policy describes information handling.' },
      ] },
    ],
  },
};
