// 已接入业务的字典由代码登记消费方；页面不能自行声明或修改接入关系。
export const accountDictionaryDefinitions = [
    {
        field: 'department',
        dictionaryCode: 'account_department',
        label: '所属部门',
        description: '账号管理与个人资料中的所属部门选项，用于展示人员归属，不参与权限判断。',
    },
    {
        field: 'position',
        dictionaryCode: 'account_position',
        label: '职务／岗位',
        description: '账号管理与个人资料中的职务／岗位选项，用于展示岗位信息，不参与授权判断。',
    },
] as const

export type AccountDictionaryField = typeof accountDictionaryDefinitions[number]['field']
