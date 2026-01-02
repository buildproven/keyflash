import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/utils/app-url'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getAppUrl()

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
  ]
}
