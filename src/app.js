import 'dotenv/config';
import { analyzePassengerMessage, analyzeDispatcherMessage } from "./utils/nlpParser.js";

async function start() {
    console.log("Ждем ответа от GigaChat...");

    const passResult = await analyzePassengerMessage("Что-то 5-го трамика долго нет на Пушкина, замерз уже");
    console.log("Результат пассажира:", passResult);

    const dispResult = await analyzeDispatcherMessage("Авария на путях, Ленина 15, встали 4 и 7 маршруты");
    console.log("Результат диспетчера:", dispResult);
}

start();