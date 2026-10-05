import { archiveDownloadUrl } from '../downloadLink'
import './DownloadLink.css'

export default function DownloadLink() {
  const Element = archiveDownloadUrl ? 'a' : 'button'
  const props = archiveDownloadUrl
    ? { href: archiveDownloadUrl, target: '_blank', rel: 'noopener noreferrer' }
    : { type: 'button', disabled: true }

  return (
    <Element {...props} className="letter-trigger download-trigger" aria-label="Download an offline copy" title={archiveDownloadUrl ? 'Download an offline copy' : 'Download available soon'}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Element>
  )
}
