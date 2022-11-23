import {render} from "./utils/render";
import {ThemeProvider} from "./fixtures/template-provider/theme-provider";
import {screen} from "@testing-library/angular";

describe("TemplateProvider", () => {
   it("should be selectable", async () => {
      const { change } = await render(ThemeProvider)

      expect(screen.getByText("Default", { selector: "button" })).toHaveStyle({ color: "rgb(255, 0, 0)" })
      expect(screen.getByText("Current", { selector: "button" })).toHaveStyle({ color: "rgb(0, 255, 0)" })

      change({
         theme: {
            color: "rgb(0, 0, 255)"
         }
      })

      expect(screen.getByText("Default", { selector: "button" })).toHaveStyle({ color: "rgb(255, 0, 0)" })
      expect(screen.getByText("Current", { selector: "button" })).toHaveStyle({ color: "rgb(0, 0, 255)" })
   })
})
