import { useTranslation } from 'react-i18next'
import Placeholder from '../../components/Placeholder'

export default function RecitePage() {
  const { t } = useTranslation()
  return <Placeholder title={t('nav.recite')} description={t('placeholder.recite')} />
}
