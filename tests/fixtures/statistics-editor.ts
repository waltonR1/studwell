import {changeFormValue,initializeSectionForm} from '../../app/utils/admin/website/section-forms'
import {sectionForms as statisticsFormForms} from './template-forms'
const statisticsForm=statisticsFormForms['home.statistics']!;
import type {CollectionField,ValueField} from '../../app/types/admin/website-section-forms'
import type {LocalizedSections} from '../../app/types/admin/website-section-editors'
import {templateDefinition as statisticsTemplateDefinition} from './reference/template-catalog'

const statisticsDefinition=statisticsTemplateDefinition('home.statistics')!
const statisticsCollection=statisticsForm.groups[1]!.fields[0] as CollectionField
const statisticsYear=statisticsForm.groups[2]!.fields[0] as ValueField
export const initializeStatistics=(value:LocalizedSections)=>initializeSectionForm(value,statisticsForm,statisticsDefinition)
export function setStatistic(value:LocalizedSections,key:string,number:number){const prepared=initializeStatistics(value);const rows=(prepared.zh as {data:{statistics:{statistics:Array<{key:string}>}}}).data.statistics.statistics;const field=statisticsCollection.fixedRows!.find(row=>row.key===key)!.fields.find(field=>field.kind==='number') as ValueField;return changeFormValue(prepared,'zh',field,'data.statistics.statistics.'+rows.findIndex(row=>row.key===key),number,'key')}
export const setStatisticYear=(value:LocalizedSections,year:number)=>changeFormValue(initializeStatistics(value),'zh',statisticsYear,'',year)
export type StatisticsContent={copy:Record<string,unknown>&{reportingYear:string};data:{statistics:{statistics:Array<{key:string;value:number;unitKey:string}>;statisticsReporting:{year:number;source:string}}}}
