// 只接受包含视频轨道、媒体数据及完整顶层box的MP4容器；不推断编码兼容性。
export function isMp4Video(bytes: Buffer) {
    let ftyp=false,mdat=false,video=false,valid=true
    function boxes(start:number,end:number,depth:number) {
        if(depth>8){valid=false;return}
        let offset=start
        while(offset<end){
            if(end-offset<8){valid=false;return}
            let size=bytes.readUInt32BE(offset),header=8
            const type=bytes.toString('ascii',offset+4,offset+8)
            if(size===1){if(end-offset<16){valid=false;return};const large=bytes.readBigUInt64BE(offset+8);if(large>BigInt(Number.MAX_SAFE_INTEGER)){valid=false;return};size=Number(large);header=16}
            else if(size===0)size=end-offset
            if(size<header || offset+size>end){valid=false;return}
            const body=offset+header,limit=offset+size
            if(depth===0 && type==='ftyp' && limit-body>=8){
                const brands=bytes.toString('ascii',body,body+4)+bytes.toString('ascii',body+8,limit)
                ftyp=/isom|iso[2-9]|mp4[12]|avc1|M4V /.test(brands)
            }
            if(depth===0 && type==='mdat' && limit>body)mdat=true
            if(['moov','trak','mdia'].includes(type))boxes(body,limit,depth+1)
            if(depth===3 && type==='hdlr' && limit-body>=12 && bytes.toString('ascii',body+8,body+12)==='vide')video=true
            offset=limit
        }
    }
    boxes(0,bytes.length,0)
    return valid && ftyp && mdat && video
}
