import { Controller, Get } from "@nestjs/common";

const defaultCardComposition = {
  bg: "linear-gradient(150deg,#F4F1F3,#E7E5EA 55%,#D8DAE4)",
  dim: 0,
  textColor: "#38323F",
  size: 30,
  weight: 700,
  align: "center",
  font: "gothic",
  textPos: null,
  sourcePos: null
};

@Controller("health")
export class HealthController {
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "saegim-api",
      product: "새김",
      contracts: {
        postUnit: "글",
        cardUnit: "장",
        privateSaveAction: "새김",
        publicReaction: "좋아요",
        defaultCardComposition
      }
    };
  }
}
