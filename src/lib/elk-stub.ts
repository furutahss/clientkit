/**
 * mermaid が ELK レイアウト（layout: elk）で読み込む elkjs の代わりのモジュール。
 * elkjs は EPL-2.0 ライセンスのため、配信物に含めないよう next.config.ts で置き換えている。
 * mermaid は読み込み時にインスタンスを作るため、実際にレイアウトを求められたときだけエラーにする。
 */
export default class ELK {
  layout(): Promise<never> {
    return Promise.reject(new Error("The ELK layout is not supported. Remove `layout: elk` to use the default layout."));
  }
}
