import {expect,it} from 'vitest'
import {sectionSearchText} from '../../server/policies/search-text'
import {publishedFieldDefinition} from '../../shared/schemas/website/section-template'
import type {SectionField} from '../../shared/types/website/section-template'

const text:SectionField={kind:'text',label:'Text'}
it('只收录字段合同中的文本，排除未声明值、技术字段和非文字类型',()=>{
    const definition=publishedFieldDefinition(JSON.parse(JSON.stringify({kind:'group',label:'Content',fields:{
        title:text,id:{...text,searchable:false},
        link:{kind:'link',label:'Link'},image:{kind:'media',label:'Image'},
        count:{kind:'number',label:'Count'},enabled:{kind:'boolean',label:'Enabled'},
        hidden:{kind:'group',label:'Hidden',searchable:false,fields:{title:text}},
        lines:{kind:'list',label:'Lines',item:text},
    }})))
    expect(sectionSearchText(definition,{
        title:'<b>Visible</b>   title',id:'secret-id',link:'/private',image:{mediaId:'private-id'},
        count:123,enabled:true,hidden:{title:'Hidden text'},lines:['First','Second'],unknown:'Undeclared',
    })).toBe('Visible title First Second')
})

it('树节点递归使用同一份字段合同，并支持关闭整个列表',()=>{
    const tree:SectionField={kind:'tree',label:'Tree',fields:{name:text,id:{...text,searchable:false}}}
    const value={name:'Parent',id:'one',children:[{name:'Child',id:'two',children:[{name:'Leaf'}]}]}
    expect(sectionSearchText(tree,value)).toBe('Parent Child Leaf')
    expect(sectionSearchText({kind:'list',label:'List',item:tree,searchable:false},[value])).toBe('')
})
