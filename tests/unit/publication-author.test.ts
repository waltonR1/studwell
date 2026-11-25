import {expect,it} from 'vitest'
import {publicationAuthorLabel,publicationAuthorStatus} from '../../app/utils/admin/website/publication-author'
it('同名账号由状态区分，正常署名不额外显示状态',()=>{
 const author={createdBy:'123',createdByUsername:'editor',createdByStatus:'active' as const}
 expect(publicationAuthorLabel(author)).toBe('editor')
 expect(publicationAuthorStatus(author)).toBe('')
 expect(publicationAuthorLabel({...author,createdByStatus:'disabled'})).toBe('editor（已停用）')
 expect(publicationAuthorLabel({...author,createdByStatus:'deleted'})).toBe('editor（已删除）')
 expect(publicationAuthorLabel({...author,createdByUsername:null,createdByStatus:'unknown'})).toBe('未知账号（账号信息缺失）')
})
