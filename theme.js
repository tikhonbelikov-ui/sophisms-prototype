/** Единственный источник цвета, типографики и отступов. */
const colors = {
  game: { bg:'#EDF5FB', surface:'#FFFFFF', surfaceAlt:'#E0EFF9', accent:'#285E94', accentSoft:'#D5E9F8', ink:'#17344F', muted:'#506C82', line:'#C8DFEF', contrast:'#FFFFFF', danger:'#A63D45', success:'#216858', heroCircle:'#D8EBFA', heroEdge:'#B4D6ED', heroLine:'#8CB6D7', secretEyebrow:'#D1EAF8', secretBody:'#E4F3FD', overlay:'rgba(15,42,67,0.36)'  },
  read: { bg:'#FAF3E7', surface:'#FFF9EE', surfaceAlt:'#F2E4CB', accent:'#985E2B', accentSoft:'#ECD2A9', ink:'#3C2C21', muted:'#705A43', line:'#DCC7A7', contrast:'#FFFFFF', danger:'#9B4646', success:'#4E7048', overlay:'rgba(59,44,30,0.35)'  },
};
const spacing={xs:4,sm:8,md:12,base:16,lg:20,xl:24,xxl:32};
const radius={sm:10,md:16,lg:22,full:999};
const type={eyebrow:13,caption:14,body:16,sub:18,heading:25,hero:34};
module.exports={colors,spacing,radius,type};
