// 在新闻详情路由与文章区块之间提供和读取文章上下文。
import {inject,provide,type InjectionKey,type Ref} from 'vue'
import type {PublicNewsArticle} from '#shared/types/public/news'

const articleContext:InjectionKey<Readonly<Ref<PublicNewsArticle|null>>>=Symbol('news-article')
export function provideNewsArticle(article:Readonly<Ref<PublicNewsArticle|null>>){provide(articleContext,article)}
export function useNewsArticle(){return inject(articleContext,undefined)}
