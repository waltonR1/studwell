// ICO directory entries contain PNG images or uncompressed Windows DIB images.
export function inspectIco(bytes:Buffer):{width:number;height:number}|null{
 if(bytes.length<22||bytes.readUInt16LE(0)!==0||bytes.readUInt16LE(2)!==1)return null
 const count=bytes.readUInt16LE(4),directoryEnd=6+count*16
 if(!count||count>256||directoryEnd>bytes.length)return null
 const ranges:Array<{start:number;end:number}>=[]
 let largest={width:0,height:0},pixels=0
 for(let i=0;i<count;i++){
  const entry=6+i*16,width=bytes[entry]||256,height=bytes[entry+1]||256
  const size=bytes.readUInt32LE(entry+8),start=bytes.readUInt32LE(entry+12),end=start+size
  if(bytes[entry+3]!==0||!size||start<directoryEnd||end>bytes.length||ranges.some(r=>start<r.end&&end>r.start))return null
  ranges.push({start,end})
  const image=bytes.subarray(start,end)
  if(image.length>=45&&image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){
   if(image.readUInt32BE(8)!==13||image.toString('ascii',12,16)!=='IHDR'||image.readUInt32BE(16)!==width||image.readUInt32BE(20)!==height||image.toString('ascii',image.length-8,image.length-4)!=='IEND'||!image.includes(Buffer.from('IDAT')))return null
  }else{
   if(image.length<40||image.readUInt32LE(0)!==40||image.readInt32LE(4)!==width||image.readInt32LE(8)!==height*2||image.readUInt16LE(12)!==1||image.readUInt32LE(16)!==0)return null
   const bits=image.readUInt16LE(14)
   if(![1,4,8,16,24,32].includes(bits))return null
   const colors=image.readUInt32LE(32),palette=bits<=8?(colors||2**bits):colors
   if(palette>(bits<=8?2**bits:256))return null
   const required=40+palette*4+Math.ceil(width*bits/32)*4*height+Math.ceil(width/32)*4*height
   if(image.length!==required)return null
  }
  pixels+=width*height
  if(pixels>40000000)return null
  if(width*height>largest.width*largest.height)largest={width,height}
 }
 return largest
}
