import type {PublicNewsArticle} from '../../shared/types/public/news'
export const previewArticle:PublicNewsArticle={
 id:'preview',slug:'preview',category:{id:'example',name:'示例分类'},
 title:'新闻文章样例',summary:'这是用于检查新闻详情布局的固定样例，不是已发布新闻。',
 publishedAt:'2026-01-01',coverImage:null,viewCount:null,seoTitle:'',seoDescription:'',source:null,
 body:[{type:'heading',text:'正文小标题'},{type:'paragraph',text:'这里展示标题、目录和文章正文的排版。调整布局不会影响任何真实文章。'}],
}
