import { expect, it } from 'vitest';
import {projectWebsiteRouteTree} from '../../shared/utils/website/route-tree'
import {type WebsiteRouteNode} from '../../shared/types/website/route'
const chain = (slugs: string[]): WebsiteRouteNode[] => slugs.map((slug, i) => ({
    id: String(i), parentId: i ? String(i - 1) : null, slug, targetType: i === slugs.length - 1 ? 'page' : 'group',
    resourceId: i === slugs.length - 1 ? '123' : null
}));
it('旧节点默认启用，停用父页面不改变子路由状态且路径仍被保留',()=>{
 const nodes:WebsiteRouteNode[]=[
  {id:'parent',parentId:null,slug:'services',targetType:'page',resourceId:'1',enabled:false},
  {id:'child',parentId:'parent',slug:'help',targetType:'page',resourceId:'2'},
 ]
 expect(projectWebsiteRouteTree(nodes)).toEqual([
  {...nodes[0],enabled:false,path:'/services'},
  {...nodes[1],enabled:true,path:'/services/help'},
 ])
 expect(()=>projectWebsiteRouteTree([...nodes,{...nodes[0]!,id:'other',resourceId:'3',enabled:true}])).toThrow(/Duplicate route path/)
})
it('projects six segments and moves all descendant paths with their ancestor', () => {
    const nodes = chain(['solutions', 'materials', 'cement', 'standards', 'europe', 'en-197']);
    expect(projectWebsiteRouteTree(nodes).at(-1)?.path).toBe('/solutions/materials/cement/standards/europe/en-197');
    nodes[0]!.slug = 'services';
    expect(projectWebsiteRouteTree(nodes).at(-1)?.path).toBe('/services/materials/cement/standards/europe/en-197');
    expect(() => projectWebsiteRouteTree(chain(['a', 'b', 'c', 'd', 'e', 'f', 'g']))).toThrow(/depth/);
});
it('rejects cycles, duplicate paths and reserved prefixes', () => {
    const nodes = chain(['solutions', 'cement']);
    nodes[0]!.parentId = '1';
    expect(() => projectWebsiteRouteTree(nodes)).toThrow(/cycle/);
    expect(() => projectWebsiteRouteTree([...chain(['about']), { ...chain(['about'])[0]!, id: '9' }])).toThrow(/Duplicate route path/);
    expect(() => projectWebsiteRouteTree(chain(['search', 'example']))).toThrow(/Reserved/);
});
it('projects a parameterized leaf alongside a fixed sibling and rejects ambiguous siblings', () => {
    const nodes = chain(['news', ':slug']);
    const archive: WebsiteRouteNode = {id: 'archive', parentId: '0', slug: 'archive', targetType: 'page', resourceId: '456'};
    expect(projectWebsiteRouteTree([...nodes, archive]).map(node => node.path)).toEqual(['/news', '/news/:slug', '/news/archive']);
    expect(() => projectWebsiteRouteTree([...nodes, {...archive, slug: ':article'}])).toThrow(/Duplicate route path/);
    expect(() => projectWebsiteRouteTree([...nodes, {...archive, parentId: '1'}])).toThrow(/leaf page/);
});
