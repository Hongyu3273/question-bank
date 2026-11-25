import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'
import { ASSET_SCHEME } from '../shared/ipc'
import type { AssetStore } from './services/assets'

/** 必须在 app ready 之前调用 */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: ASSET_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }
  ])
}

/** app ready 之后调用:qb-asset://<bankId>/images/xxx.png → 读取本地图片 */
export function handleAssetProtocol(store: AssetStore): void {
  protocol.handle(ASSET_SCHEME, (request) => {
    const file = store.resolveUrl(request.url)
    if (!file) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
}
