// 共用发布数据、展示数据与业务状态；DOM 生命周期由展示组件管理。
import { useNewsPath } from '~/composables/public/sections/news/useNewsPath';
import { useNewsArticle } from '~/composables/public/sections/news/articleContext';
export function useNewsDetailArticleSection() {
  const newsPath = useNewsPath();
  const article = useNewsArticle();
  const localePath = useLocalePath();
  const headings = computed(() => (article?.value?.body ?? []).flatMap((block, index) => block.type === 'heading' ? [{ text: block.text, id: `news-heading-${index}` }] : []));
  return { newsPath, article, localePath, headings };
}
