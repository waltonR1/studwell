import data from './image-rules.json'
import {imageRuleSchema} from '../../../shared/schemas/image-presentation'
export default Object.fromEntries(Object.entries(data).map(([key,value])=>[key,imageRuleSchema.parse(value)]))
