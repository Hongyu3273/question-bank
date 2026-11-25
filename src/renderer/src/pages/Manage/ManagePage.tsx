import { useTranslation } from 'react-i18next'
import Placeholder from '../../components/Placeholder'

export default function ManagePage() {
  const { t } = useTranslation()
  return <Placeholder title={t('nav.manage')} description={t('placeholder.manage')} />
}
