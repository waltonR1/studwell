import {expect,it} from 'vitest'
import {newsDetailPath,newsListingPath} from '../../shared/utils/website/news-route'

it('builds article links from the published layout belonging to the chosen list',()=>{
 const first={path:'/updates/:slug',sections:[{templateKey:'custom.article',capabilities:['news.article']}]}
 const second={path:'/company/news/:slug',sections:[{templateKey:'custom.article',capabilities:['news.article']}]}
 expect(newsDetailPath([first,second],'/company/news','launch')).toBe('/company/news/launch')
 expect(newsListingPath(second)).toBe('/company/news')
 expect(newsDetailPath([first,second],'/old-news','launch')).toBe('')
 expect(newsDetailPath([first,second],'/updates','x/y')).toBe('')
})
