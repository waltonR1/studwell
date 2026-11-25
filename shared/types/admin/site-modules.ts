import type {SiteModuleName} from '../../config/site-modules'
export interface SiteModuleUsage {key:string;name:string;sectionNames:string[]}
export interface SiteModuleState {module:SiteModuleName;name:string;enabled:boolean;version:number;usages:SiteModuleUsage[]}
export interface SiteModuleUpdate {version:number;enabled:boolean}
